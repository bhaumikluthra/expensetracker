package handler

import (
	"errors"
	"io"
	"net/http"
	"strings"

	"personal-expense-tracker/internal/service"

	"github.com/gin-gonic/gin"
)

type ImportHandler struct {
	importService *service.CSVImportService
}

func NewImportHandler(importService *service.CSVImportService) *ImportHandler {
	return &ImportHandler{importService: importService}
}

func (h *ImportHandler) getUserID(c *gin.Context) (uint, bool) {
	value, exists := c.Get("userID")
	if !exists {
		return 0, false
	}
	if floatID, ok := value.(float64); ok {
		return uint(floatID), true
	}
	if uintID, ok := value.(uint); ok {
		return uintID, true
	}
	return 0, false
}

// ImportCSV accepts multipart file "file" and uses Gemini to parse and import expenses.
func (h *ImportHandler) ImportCSV(c *gin.Context) {
	userID, ok := h.getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "CSV file is required (field name: file)"})
		return
	}

	if !strings.HasSuffix(strings.ToLower(file.Filename), ".csv") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "only .csv files are supported"})
		return
	}

	f, err := file.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read uploaded file"})
		return
	}
	defer f.Close()

	csvBytes, err := io.ReadAll(f)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read file contents"})
		return
	}

	defaultCategory := strings.TrimSpace(c.PostForm("default_category"))
	if defaultCategory == "" {
		defaultCategory = "Other"
	}

	result, err := h.importService.ImportFromCSV(userID, csvBytes, file.Filename, defaultCategory)
	if err != nil {
		var missing *service.ImportMissingFieldsError
		if errors.As(err, &missing) {
			c.JSON(http.StatusUnprocessableEntity, gin.H{
				"error":          "Required details missing from CSV",
				"message":        missing.Detail,
				"missing_fields": missing.Fields,
			})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "CSV import completed",
		"data":    result,
	})
}
