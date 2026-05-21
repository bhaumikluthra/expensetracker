package gemini

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

const defaultModel = "gemini-2.0-flash"
const apiBase = "https://generativelanguage.googleapis.com/v1beta/models"

type Client struct {
	apiKey string
	model  string
	http   *http.Client
}

func NewClient() *Client {
	model := os.Getenv("GEMINI_MODEL")
	if model == "" {
		model = defaultModel
	}
	return &Client{
		apiKey: strings.TrimSpace(os.Getenv("GEMINI_API_KEY")),
		model:  model,
		http:   &http.Client{Timeout: 90 * time.Second},
	}
}

func (c *Client) Enabled() bool {
	return c.apiKey != ""
}

type generateRequest struct {
	Contents         []content        `json:"contents"`
	GenerationConfig generationConfig `json:"generationConfig"`
}

type content struct {
	Parts []part `json:"parts"`
}

type part struct {
	Text string `json:"text"`
}

type generationConfig struct {
	ResponseMIMEType string  `json:"responseMimeType"`
	Temperature      float64 `json:"temperature"`
}

type generateResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
	Error *struct {
		Message string `json:"message"`
		Code    int    `json:"code"`
	} `json:"error"`
}

// ParsedExpense is one normalized row returned by Gemini.
type ParsedExpense struct {
	Date        string  `json:"date"`
	Amount      float64 `json:"amount"`
	Description string  `json:"description"`
	Category    string  `json:"category"`
}

// ParseCSVResponse is the structured JSON we ask Gemini to return.
type ParseCSVResponse struct {
	CanImport       bool            `json:"can_import"`
	MissingFields   []string        `json:"missing_fields"`
	MissingMessage  string          `json:"missing_message"`
	Rows            []ParsedExpense `json:"rows"`
	SkippedRows     []SkippedRow    `json:"skipped_rows"`
}

type SkippedRow struct {
	Raw    string `json:"raw"`
	Reason string `json:"reason"`
}

func (c *Client) ParseCSV(csvText, filename, filenameDateHint string, existingCategories []string, defaultCategory string) (*ParseCSVResponse, error) {
	if !c.Enabled() {
		return nil, fmt.Errorf("GEMINI_API_KEY is not configured")
	}

	cats := "none yet"
	if len(existingCategories) > 0 {
		cats = strings.Join(existingCategories, ", ")
	}
	if defaultCategory == "" {
		defaultCategory = "Other"
	}

	prompt := fmt.Sprintf(`You import expense transactions from a CSV file into an expense tracker (INR).

FILENAME: %q
%s

TASK: Extract every transaction row. Output date (YYYY-MM-DD), amount (positive), description, category.

DATE rules (important):
1. If the CSV has a Date column, use it.
2. If the CSV has only Day (1-31) without month/year, combine with month/year from the FILENAME.
3. If the CSV has NO date column, infer dates from the FILENAME:
   - e.g. "expenses_2025-01-15_to_2025-01-31.csv" → spread rows across that range or use start date
   - e.g. "jan_2025_statement.csv" → use that month (row 1 = day 1, row 2 = day 2, etc.)
   - e.g. "transactions_2025-03-10.csv" → use 2025-03-10 for all rows
4. Ignore balance, account number, and other non-transaction columns.

AMOUNT: use Amount, Debit, Withdrawal (not Credit if Debit exists).
CATEGORY: default "%s" or infer from description. User categories: [%s]

Skip rows without amount. If no date can be resolved from CSV or filename, set can_import false and missing_fields ["date"].

Return JSON only:
{"can_import":true,"missing_fields":[],"missing_message":"","rows":[{"date":"YYYY-MM-DD","amount":1.0,"description":"","category":""}],"skipped_rows":[]}

CSV CONTENT:
%s`, filename, filenameDateHint, defaultCategory, cats, csvText)

	body := generateRequest{
		Contents: []content{{Parts: []part{{Text: prompt}}}},
		GenerationConfig: generationConfig{
			ResponseMIMEType: "application/json",
			Temperature:      0.1,
		},
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("%s/%s:generateContent?key=%s", apiBase, c.model, c.apiKey)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("gemini request failed: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("gemini API error (status %d): %s", resp.StatusCode, string(raw))
	}

	var genResp generateResponse
	if err := json.Unmarshal(raw, &genResp); err != nil {
		return nil, fmt.Errorf("failed to decode gemini response: %w", err)
	}
	if genResp.Error != nil {
		return nil, fmt.Errorf("gemini error: %s", genResp.Error.Message)
	}
	if len(genResp.Candidates) == 0 || len(genResp.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("empty response from gemini")
	}

	text := strings.TrimSpace(genResp.Candidates[0].Content.Parts[0].Text)
	text = strings.TrimPrefix(text, "```json")
	text = strings.TrimPrefix(text, "```")
	text = strings.TrimSuffix(text, "```")
	text = strings.TrimSpace(text)

	var parsed ParseCSVResponse
	if err := json.Unmarshal([]byte(text), &parsed); err != nil {
		return nil, fmt.Errorf("failed to parse gemini JSON output: %w", err)
	}

	return &parsed, nil
}
