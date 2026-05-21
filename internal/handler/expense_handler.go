package handler

import (
	"net/http"
	"strconv"
	"time"

	"personal-expense-tracker/internal/domain"
	"personal-expense-tracker/internal/infrastructure/kafka" // NEW: Import your Kafka package

	"github.com/gin-gonic/gin"
)

type ExpenseHandler struct {
	service       domain.ExpenseService
	kafkaProducer *kafka.ExpenseProducer // NEW: Added Kafka producer to the struct
}

// NEW: Updated constructor to accept the Kafka producer
func NewExpenseHandler(service domain.ExpenseService, producer *kafka.ExpenseProducer) *ExpenseHandler {
	return &ExpenseHandler{
		service:       service,
		kafkaProducer: producer,
	}
}

func (h *ExpenseHandler) getUserID(c *gin.Context) (uint, bool) {
	value, exists := c.Get("userID")
	if !exists {
		return 0, false
	}

	// FIX: Safely convert float64 to uint
	if floatID, ok := value.(float64); ok {
		return uint(floatID), true
	}

	if uintID, ok := value.(uint); ok {
		return uintID, true
	}

	return 0, false
}

// 🚀 NEW: Async Bulk Import Method using Kafka
func (h *ExpenseHandler) BulkImportExpense(c *gin.Context) {
	userID, ok := h.getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	var input struct {
		Amount      float64   `json:"amount" binding:"required"`
		Description string    `json:"description"`
		Date        time.Time `json:"date"`
		CategoryID  uint      `json:"category_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	// Create the domain Expense object
	expense := domain.Expense{
		UserID:      userID, // CRITICAL: Assign the logged-in user so the worker knows who owns this!
		Amount:      input.Amount,
		Description: input.Description,
		Date:        input.Date,
		CategoryID:  input.CategoryID,
	}

	// Try to push to Kafka Queue; if unavailable, fall back to synchronous DB save
	if h.kafkaProducer != nil {
		if err := h.kafkaProducer.PublishExpenseImport(expense); err == nil {
			c.JSON(http.StatusAccepted, gin.H{"message": "Expense queued for background processing"})
			return
		} else {
			// Log and continue to fallback
			c.Error(err)
		}
	}

	// Fallback: save synchronously to DB
	created, err := h.service.CreateExpense(expense.UserID, expense.Amount, expense.Description, expense.Date, expense.CategoryID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save expense"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": created})
}

// ==========================================
// Existing Synchronous Methods Below
// ==========================================

func (h *ExpenseHandler) CreateExpense(c *gin.Context) {
	userID, ok := h.getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	var input struct {
		Amount      float64   `json:"amount" binding:"required"`
		Description string    `json:"description"`
		Date        time.Time `json:"date"`
		CategoryID  uint      `json:"category_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	// Create the domain object with the user ID attached
	expense := domain.Expense{
		UserID:      userID,
		Amount:      input.Amount,
		Description: input.Description,
		Date:        input.Date,
		CategoryID:  input.CategoryID,
	}

	created, err := h.service.CreateExpense(expense.UserID, expense.Amount, expense.Description, expense.Date, expense.CategoryID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": created})
}

func (h *ExpenseHandler) GetAllExpenses(c *gin.Context) {
	userID, ok := h.getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	expenses, err := h.service.GetAllExpenses(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch expenses"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": expenses})
}

func (h *ExpenseHandler) UpdateExpense(c *gin.Context) {
	userID, ok := h.getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid expense ID"})
		return
	}

	var input struct {
		Amount      float64   `json:"amount" binding:"required"`
		Description string    `json:"description"`
		Date        time.Time `json:"date"`
		CategoryID  uint      `json:"category_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	expense, err := h.service.UpdateExpense(uint(id), userID, input.Amount, input.Description, input.Date, input.CategoryID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": expense})
}

func (h *ExpenseHandler) DeleteExpense(c *gin.Context) {
	userID, ok := h.getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid expense ID"})
		return
	}

	if err := h.service.DeleteExpense(uint(id), userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Expense deleted successfully"})
}

func (h *ExpenseHandler) DeleteAllExpenses(c *gin.Context) {
	userID, ok := h.getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	if err := h.service.DeleteAllExpenses(userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete all expenses"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "All expenses deleted successfully"})
}
