package service

import "strings"

// ImportMissingFieldsError is returned when the CSV lacks required expense fields.
type ImportMissingFieldsError struct {
	Fields  []string
	Detail  string
}

func (e *ImportMissingFieldsError) Error() string {
	if e.Detail != "" {
		return e.Detail
	}
	return "required details missing from CSV: " + strings.Join(e.Fields, ", ")
}
