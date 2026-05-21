package service

import (
	"encoding/csv"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"personal-expense-tracker/internal/infrastructure/gemini"
)

var headerSynonyms = map[string][]string{
	"date": {
		"transaction date", "txn date", "posting date", "value date", "trans date",
		"date", "posted", "time",
	},
	"day": {"day", "dom", "day of month", "date day"},
	"amount": {
		"amount (inr)", "amount inr", "transaction amount", "withdrawal amount",
		"debit amount", "debit", "withdrawal", "spent", "expense amount", "expense",
		"amount", "inr", "payment",
	},
	"credit": {"credit", "deposit", "credit amount"},
	"description": {
		"description", "narration", "memo", "particulars", "payee", "details",
		"remark", "remarks", "notes", "merchant", "title", "name",
	},
	"category": {"category", "type", "tag", "expense type", "classification"},
}

var categoryKeywords = map[string][]string{
	"Food":          {"swiggy", "zomato", "restaurant", "cafe", "food", "lunch", "dinner", "breakfast", "dominos"},
	"Transport":     {"uber", "ola", "rapido", "petrol", "fuel", "diesel", "metro", "irctc", "redbus", "cab"},
	"Shopping":      {"amazon", "flipkart", "myntra", "ajio", "meesho", "shopping"},
	"Entertainment": {"netflix", "spotify", "hotstar", "prime video", "movie", "cinema"},
	"Bills":         {"electricity", "bescom", "rent", "recharge", "jio", "airtel", "bill", "emi"},
	"Health":        {"pharmacy", "hospital", "medical", "apollo", "1mg"},
}

type columnMap struct {
	date        int
	day         int
	amount      int
	debit       int
	credit      int
	description int
	category    int
}

func (m columnMap) amountCol() int {
	if m.debit >= 0 {
		return m.debit
	}
	if m.amount >= 0 {
		return m.amount
	}
	if m.credit >= 0 {
		return m.credit
	}
	return -1
}

func parseCSVWithRules(csvBytes []byte, filename string, existingCategories []string, defaultCategory string) (*gemini.ParseCSVResponse, error) {
	fileDateCtx := parseFilenameDate(filename)
	csvBytes = stripBOM(csvBytes)
	text := string(csvBytes)
	delimiter := detectDelimiter(text)

	records, err := readCSVRecords(text, delimiter)
	if err != nil {
		return nil, fmt.Errorf("invalid CSV format: %w", err)
	}
	if len(records) == 0 {
		return missingFieldsResponse([]string{"date", "amount"}, "CSV file is empty")
	}

	headerIdx, colMap := findHeaderAndColumns(records)
	if headerIdx < 0 || colMap.date < 0 || colMap.amountCol() < 0 {
		// Last resort: infer columns from data patterns
		headerIdx, colMap = inferColumnsFromData(records)
	}
	if colMap.amountCol() < 0 {
		return missingFieldsResponse([]string{"amount"},
			"Could not find amount in CSV. Need an Amount or Debit column.")
	}
	hasDateColumn := colMap.date >= 0 || colMap.day >= 0
	if !hasDateColumn && !fileDateCtx.Found {
		return missingFieldsResponse([]string{"date"},
			"No date column in CSV and could not infer date from filename. Name file like expenses_2025-01-15.csv or jan_2025_statement.csv")
	}

	if defaultCategory == "" {
		defaultCategory = "Other"
	}

	resp := &gemini.ParseCSVResponse{CanImport: true}
	amountCol := colMap.amountCol()
	useCredit := colMap.credit >= 0 && colMap.debit < 0 && colMap.amount < 0

	startRow := headerIdx + 1
	if headerIdx < 0 {
		startRow = 0
	}
	rowNum := 0
	for i := startRow; i < len(records); i++ {
		row := records[i]
		if isEmptyRow(row) {
			continue
		}

		dateStr := ""
		if colMap.date >= 0 {
			dateStr = cell(row, colMap.date)
		}
		if dateStr == "" && colMap.day >= 0 && fileDateCtx.Found {
			if d, err := fileDateCtx.mergeDayWithFileContext(cell(row, colMap.day)); err == nil {
				dateStr = d
			}
		}
		if dateStr == "" && fileDateCtx.Found {
			if d, err := fileDateCtx.dateForRow(rowNum); err == nil {
				dateStr = d
			}
		}
		rowNum++

		amountStr := cell(row, amountCol)
		if useCredit {
			amountStr = cell(row, colMap.credit)
		}

		desc := ""
		if colMap.description >= 0 {
			desc = cell(row, colMap.description)
		}
		cat := defaultCategory
		if colMap.category >= 0 {
			if c := cell(row, colMap.category); c != "" {
				cat = c
			}
		}
		if colMap.category < 0 || cat == defaultCategory {
			cat = inferCategory(desc, existingCategories, defaultCategory)
		}

		amount, err := parseAmount(amountStr)
		if err != nil || amount <= 0 {
			// Try any numeric column in row as amount fallback
			if amount, err = findAmountInRow(row, colMap); err != nil || amount <= 0 {
				resp.SkippedRows = append(resp.SkippedRows, gemini.SkippedRow{
					Raw:    strings.Join(row, ","),
					Reason: fmt.Sprintf("could not parse amount (%q)", amountStr),
				})
				continue
			}
		}

		dateISO, err := parseDateToISO(dateStr)
		if err != nil {
			resp.SkippedRows = append(resp.SkippedRows, gemini.SkippedRow{
				Raw:    strings.Join(row, ","),
				Reason: fmt.Sprintf("could not parse date (%q)", dateStr),
			})
			continue
		}

		resp.Rows = append(resp.Rows, gemini.ParsedExpense{
			Date:        dateISO,
			Amount:      amount,
			Description: desc,
			Category:    cat,
		})
	}

	if len(resp.Rows) == 0 {
		return missingFieldsResponse([]string{"date", "amount"},
			"No valid transactions found. Ensure rows have parseable date and positive amount.")
	}

	return resp, nil
}

func missingFieldsResponse(fields []string, msg string) (*gemini.ParseCSVResponse, error) {
	return &gemini.ParseCSVResponse{
		CanImport:      false,
		MissingFields:  fields,
		MissingMessage: msg,
	}, nil
}

func stripBOM(b []byte) []byte {
	if len(b) >= 3 && b[0] == 0xEF && b[1] == 0xBB && b[2] == 0xBF {
		return b[3:]
	}
	return b
}

func detectDelimiter(text string) rune {
	firstLine := text
	if idx := strings.IndexAny(text, "\r\n"); idx >= 0 {
		firstLine = text[:idx]
	}
	commas := strings.Count(firstLine, ",")
	semis := strings.Count(firstLine, ";")
	if semis > commas {
		return ';'
	}
	return ','
}

func readCSVRecords(text string, delimiter rune) ([][]string, error) {
	reader := csv.NewReader(strings.NewReader(text))
	reader.Comma = delimiter
	reader.TrimLeadingSpace = true
	reader.LazyQuotes = true
	reader.FieldsPerRecord = -1
	return reader.ReadAll()
}

func findHeaderAndColumns(records [][]string) (int, columnMap) {
	bestIdx := -1
	bestScore := 0
	var bestMap columnMap

	limit := len(records)
	if limit > 20 {
		limit = 20
	}

	for i := 0; i < limit; i++ {
		m := mapHeaders(records[i])
		score := headerScore(m)
		if score > bestScore {
			bestScore = score
			bestIdx = i
			bestMap = m
		}
	}

	// Need at least (date or day) + amount/debit
	if bestScore >= 2 && (bestMap.date >= 0 || bestMap.day >= 0) && bestMap.amountCol() >= 0 {
		return bestIdx, bestMap
	}
	if bestScore >= 2 && bestMap.amountCol() >= 0 {
		return bestIdx, bestMap
	}
	return -1, columnMap{}
}

func headerScore(m columnMap) int {
	score := 0
	if m.date >= 0 || m.day >= 0 {
		score += 2
	}
	if m.amountCol() >= 0 {
		score += 2
	}
	if m.description >= 0 {
		score++
	}
	if m.category >= 0 {
		score++
	}
	return score
}

func mapHeaders(headers []string) columnMap {
	var m columnMap
	m.date, m.day, m.amount, m.debit, m.credit, m.description, m.category = -1, -1, -1, -1, -1, -1, -1

	type candidate struct {
		field string
		idx   int
		score int
	}
	var candidates []candidate

	for i, h := range headers {
		norm := normalizeHeader(h)
		if norm == "" {
			continue
		}
		for field, synonyms := range headerSynonyms {
			for _, syn := range synonyms {
				s := scoreHeaderMatch(norm, syn)
				if s > 0 {
					candidates = append(candidates, candidate{field, i, s})
				}
			}
		}
	}

	// Assign best score per field
	fields := []string{"date", "day", "amount", "debit", "credit", "description", "category"}
	for _, f := range fields {
		best := -1
		bestIdx := -1
		for _, c := range candidates {
			if c.field != f {
				continue
			}
			if c.score > best {
				best = c.score
				bestIdx = c.idx
			}
		}
		switch f {
		case "date":
			m.date = bestIdx
		case "day":
			m.day = bestIdx
		case "amount":
			m.amount = bestIdx
		case "debit":
			m.debit = bestIdx
		case "credit":
			m.credit = bestIdx
		case "description":
			m.description = bestIdx
		case "category":
			m.category = bestIdx
		}
	}
	return m
}

func scoreHeaderMatch(header, synonym string) int {
	if header == synonym {
		return 100
	}
	if strings.HasPrefix(header, synonym+" ") || strings.HasPrefix(header, synonym+"(") {
		return 90
	}
	if strings.HasSuffix(header, " "+synonym) {
		return 85
	}
	// Avoid "updated" matching "date"
	if synonym == "date" && strings.Contains(header, "update") {
		return 0
	}
	if len(synonym) >= 4 && strings.Contains(header, synonym) {
		return 70
	}
	return 0
}

func inferColumnsFromData(records [][]string) (int, columnMap) {
	if len(records) < 2 {
		return -1, columnMap{}
	}

	maxCols := 0
	for _, r := range records {
		if len(r) > maxCols {
			maxCols = len(r)
		}
	}

	dateScores := make([]int, maxCols)
	amountScores := make([]int, maxCols)
	textScores := make([]int, maxCols)

	start := 0
	if len(records) > 5 {
		start = 1 // skip possible title row
	}

	for i := start; i < len(records) && i < start+30; i++ {
		row := records[i]
		for c := 0; c < len(row); c++ {
			v := strings.TrimSpace(row[c])
			if v == "" {
				continue
			}
			if _, err := parseDateToISO(v); err == nil {
				dateScores[c]++
			}
			if amt, err := parseAmount(v); err == nil && amt > 0 && amt < 100000000 {
				amountScores[c]++
			}
			if len(v) > 8 && !isMostlyNumeric(v) {
				textScores[c]++
			}
		}
	}

	dateCol := bestCol(dateScores)
	amountCol := bestCol(amountScores)
	descCol := bestCol(textScores)

	if dateCol >= 0 && amountCol >= 0 {
		m := columnMap{date: dateCol, amount: amountCol, description: descCol}
		if descCol == dateCol || descCol == amountCol {
			m.description = -1
		}
		return -1, m // no header row — all rows are data
	}
	return -1, columnMap{}
}

func bestCol(scores []int) int {
	best, idx := 0, -1
	for i, s := range scores {
		if s > best {
			best = s
			idx = i
		}
	}
	if best >= 2 {
		return idx
	}
	if best >= 1 {
		return idx
	}
	return -1
}

func isMostlyNumeric(s string) bool {
	digits := 0
	for _, r := range s {
		if r >= '0' && r <= '9' {
			digits++
		}
	}
	return digits > len(s)/2
}

func findAmountInRow(row []string, m columnMap) (float64, error) {
	skip := map[int]bool{m.date: true, m.description: true, m.category: true}
	for i, cell := range row {
		if skip[i] {
			continue
		}
		if amt, err := parseAmount(cell); err == nil && amt > 0 {
			return amt, nil
		}
	}
	return 0, fmt.Errorf("no amount")
}

func normalizeHeader(h string) string {
	h = strings.TrimSpace(strings.ToLower(h))
	h = strings.Trim(h, `"`)
	h = strings.ReplaceAll(h, "\ufeff", "")
	re := regexp.MustCompile(`[^a-z0-9() ]+`)
	h = re.ReplaceAllString(h, " ")
	re2 := regexp.MustCompile(`\s+`)
	return strings.TrimSpace(re2.ReplaceAllString(h, " "))
}

func cell(row []string, idx int) string {
	if idx < 0 || idx >= len(row) {
		return ""
	}
	return strings.TrimSpace(strings.Trim(row[idx], `"`))
}

func isEmptyRow(row []string) bool {
	for _, c := range row {
		if strings.TrimSpace(c) != "" {
			return false
		}
	}
	return true
}

func parseAmount(s string) (float64, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, fmt.Errorf("empty")
	}

	negative := strings.HasPrefix(s, "(") && strings.HasSuffix(s, ")")
	s = strings.Trim(s, "()")
	s = strings.ReplaceAll(s, "₹", "")
	s = strings.ReplaceAll(s, "inr", "")
	s = strings.ReplaceAll(s, " ", "")

	// Indian: 1,23,456.78 or 1,234.56
	if strings.Count(s, ",") > 0 && strings.Contains(s, ".") {
		s = strings.ReplaceAll(s, ",", "")
	} else if strings.Count(s, ",") == 1 && !strings.Contains(s, ".") {
		// European 1234,56
		s = strings.ReplaceAll(s, ",", ".")
	} else {
		s = strings.ReplaceAll(s, ",", "")
	}

	re := regexp.MustCompile(`[^0-9.\-]`)
	s = re.ReplaceAllString(s, "")
	s = strings.TrimPrefix(s, "-")
	if s == "" || s == "." {
		return 0, fmt.Errorf("empty")
	}

	f, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0, err
	}
	if negative {
		f = -f
	}
	if f < 0 {
		f = -f // expenses stored as positive
	}
	return f, nil
}

func parseDateToISO(s string) (string, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return "", fmt.Errorf("empty date")
	}

	// Excel serial number
	if serial, err := strconv.ParseFloat(s, 64); err == nil && serial > 30000 && serial < 60000 {
		t := excelSerialToTime(serial)
		return t.Format("2006-01-02"), nil
	}

	t, err := parseFlexibleDate(s)
	if err != nil {
		return "", err
	}
	return t.Format("2006-01-02"), nil
}

func excelSerialToTime(serial float64) time.Time {
	// Excel day 1 = 1899-12-30 for Windows
	base := time.Date(1899, 12, 30, 0, 0, 0, 0, time.UTC)
	return base.Add(time.Duration(serial*24) * time.Hour)
}

func parseFlexibleDate(s string) (time.Time, error) {
	s = strings.TrimSpace(strings.Trim(s, `"`))
	if s == "" {
		return time.Time{}, fmt.Errorf("empty")
	}

	layouts := []string{
		time.RFC3339,
		"2006-01-02",
		"2006-01-02 15:04:05",
		"02-01-2006",
		"02/01/2006",
		"01/02/2006",
		"2/1/2006",
		"01-02-2006",
		"2006/01/02",
		"Jan 2, 2006",
		"January 2, 2006",
		"2 Jan 2006",
		"02 Jan 2006",
		"2006-1-2",
		"2-1-2006",
	}

	for _, layout := range layouts {
		if t, err := time.Parse(layout, s); err == nil {
			return t, nil
		}
	}

	// locale-style: 5/21/2026 or 21/5/2026 — try day-first then month-first
	if t, ok := parseSlashDate(s, true); ok {
		return t, nil
	}
	if t, ok := parseSlashDate(s, false); ok {
		return t, nil
	}

	return time.Time{}, fmt.Errorf("unrecognized: %s", s)
}

func parseSlashDate(s string, dayFirst bool) (time.Time, bool) {
	parts := strings.Split(s, "/")
	if len(parts) != 3 {
		return time.Time{}, false
	}
	a, err1 := strconv.Atoi(strings.TrimSpace(parts[0]))
	b, err2 := strconv.Atoi(strings.TrimSpace(parts[1]))
	y, err3 := strconv.Atoi(strings.TrimSpace(parts[2]))
	if err1 != nil || err2 != nil || err3 != nil {
		return time.Time{}, false
	}
	if y < 100 {
		y += 2000
	}
	var day, month int
	if dayFirst {
		day, month = a, b
	} else {
		month, day = a, b
	}
	if month < 1 || month > 12 || day < 1 || day > 31 {
		return time.Time{}, false
	}
	return time.Date(y, time.Month(month), day, 12, 0, 0, 0, time.UTC), true
}

func inferCategory(description string, existing []string, fallback string) string {
	lower := strings.ToLower(description)
	for _, name := range existing {
		if name != "" && strings.Contains(lower, strings.ToLower(name)) {
			return name
		}
	}
	for cat, keywords := range categoryKeywords {
		for _, kw := range keywords {
			if strings.Contains(lower, kw) {
				return cat
			}
		}
	}
	if fallback == "" {
		return "Other"
	}
	return fallback
}

func isGeminiQuotaError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "429") ||
		strings.Contains(msg, "quota") ||
		strings.Contains(msg, "resource_exhausted") ||
		strings.Contains(msg, "rate limit")
}
