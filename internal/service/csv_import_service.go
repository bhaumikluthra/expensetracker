package service

import (
	"errors"
	"fmt"
	"strings"

	"personal-expense-tracker/internal/domain"
	"personal-expense-tracker/internal/infrastructure/gemini"
)

const (
	maxCSVBytes   = 2 * 1024 * 1024 // 2MB
	maxImportRows = 500
)

type CSVImportResult struct {
	Imported    int                 `json:"imported"`
	Failed      int                 `json:"failed"`
	Skipped     int                 `json:"skipped"`
	Parser      string              `json:"parser"` // "ai" or "rules"
	Errors      []string            `json:"errors"`
	SkippedRows []gemini.SkippedRow `json:"skipped_rows"`
}

type CSVImportService struct {
	gemini          *gemini.Client
	expenseService  domain.ExpenseService
	categoryService domain.CategoryService
}

func NewCSVImportService(g *gemini.Client, expense domain.ExpenseService, category domain.CategoryService) *CSVImportService {
	return &CSVImportService{
		gemini:          g,
		expenseService:  expense,
		categoryService: category,
	}
}

func (s *CSVImportService) ImportFromCSV(userID uint, csvBytes []byte, filename, defaultCategory string) (*CSVImportResult, error) {
	if len(csvBytes) == 0 {
		return nil, errors.New("CSV file is empty")
	}
	if len(csvBytes) > maxCSVBytes {
		return nil, fmt.Errorf("CSV file too large (max %d MB)", maxCSVBytes/(1024*1024))
	}

	csvText := string(csvBytes)
	if strings.Count(csvText, "\n") > maxImportRows+5 {
		return nil, fmt.Errorf("CSV has too many rows (max %d)", maxImportRows)
	}

	categories, err := s.categoryService.GetAllCategories(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to load categories: %w", err)
	}

	names := make([]string, 0, len(categories))
	for _, c := range categories {
		names = append(names, c.Name)
	}

	parsed, parserUsed, err := s.parseCSV(csvBytes, csvText, filename, names, defaultCategory)
	if err != nil {
		return nil, err
	}

	if err := validateParsedCSV(parsed, defaultCategory); err != nil {
		return nil, err
	}

	result := &CSVImportResult{
		SkippedRows: parsed.SkippedRows,
		Skipped:     len(parsed.SkippedRows),
		Parser:      parserUsed,
	}

	if len(parsed.Rows) > maxImportRows {
		return nil, fmt.Errorf("too many expense rows after parsing (max %d)", maxImportRows)
	}

	for i, row := range parsed.Rows {
		if err := s.importRow(userID, row, defaultCategory); err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("row %d: %s", i+1, err.Error()))
			continue
		}
		result.Imported++
	}

	return result, nil
}

func (s *CSVImportService) parseCSV(csvBytes []byte, csvText, filename string, categoryNames []string, defaultCategory string) (*gemini.ParseCSVResponse, string, error) {
	fileDateCtx := parseFilenameDate(filename)

	// Rule-based parser first — reliable, free, handles BucksFlow export and bank CSVs
	parsed, err := parseCSVWithRules(csvBytes, filename, categoryNames, defaultCategory)
	if err == nil && len(parsed.Rows) > 0 {
		return parsed, "rules", nil
	}

	if s.gemini.Enabled() {
		aiParsed, aiErr := s.gemini.ParseCSV(csvText, filename, fileDateCtx.promptHint(), categoryNames, defaultCategory)
		if aiErr == nil && len(aiParsed.Rows) > 0 {
			return aiParsed, "ai", nil
		}
		if err == nil && parsed != nil && len(parsed.Rows) == 0 {
			return parsed, "rules", nil // return validation message from rules
		}
		if aiErr != nil && isGeminiQuotaError(aiErr) && parsed != nil {
			return parsed, "rules", nil
		}
		if aiErr != nil && parsed == nil {
			return nil, "", aiErr
		}
	}

	if err != nil {
		return nil, "", err
	}
	return parsed, "rules", nil
}

func (s *CSVImportService) importRow(userID uint, row gemini.ParsedExpense, defaultCategory string) error {
	amount := row.Amount
	if amount <= 0 {
		return errors.New("amount must be greater than zero")
	}

	date, err := parseFlexibleDate(row.Date)
	if err != nil {
		return err
	}

	categoryName := strings.TrimSpace(row.Category)
	if categoryName == "" {
		categoryName = strings.TrimSpace(defaultCategory)
	}
	if categoryName == "" {
		categoryName = "Other"
	}

	cat, _, err := s.categoryService.CreateCategory(userID, categoryName)
	if err != nil {
		return fmt.Errorf("category: %w", err)
	}

	_, err = s.expenseService.CreateExpense(userID, amount, strings.TrimSpace(row.Description), date, cat.ID)
	if err != nil {
		return err
	}
	return nil
}

func validateParsedCSV(parsed *gemini.ParseCSVResponse, defaultCategory string) error {
	if !parsed.CanImport {
		return newMissingFieldsError(parsed)
	}
	if len(parsed.MissingFields) > 0 {
		return newMissingFieldsError(parsed)
	}
	if len(parsed.Rows) == 0 {
		msg := strings.TrimSpace(parsed.MissingMessage)
		if msg == "" {
			msg = "No valid expense rows found. The CSV must include date and amount for each transaction."
		}
		fields := parsed.MissingFields
		if len(fields) == 0 {
			fields = []string{"date", "amount"}
		}
		return &ImportMissingFieldsError{Fields: fields, Detail: msg}
	}

	return nil
}

func newMissingFieldsError(parsed *gemini.ParseCSVResponse) error {
	fields := parsed.MissingFields
	if len(fields) == 0 {
		fields = []string{"date", "amount"}
	}
	detail := strings.TrimSpace(parsed.MissingMessage)
	if detail == "" {
		detail = "Required details missing from CSV: " + strings.Join(fields, ", ")
	}
	return &ImportMissingFieldsError{Fields: fields, Detail: detail}
}

