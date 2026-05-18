package handler

import (
	"net/http"
	"personal-expense-tracker/internal/domain"

	"github.com/gin-gonic/gin"
)

type DashboardHandler struct {
	service domain.DashboardService
}

func NewDashboardHandler(service domain.DashboardService) *DashboardHandler {
	return &DashboardHandler{service: service}
}

func (h *DashboardHandler) getUserID(c *gin.Context) (uint, bool) {
	value, exists := c.Get("userID")
	if !exists {
		return 0, false
	}
	userID, ok := value.(uint)
	return userID, ok
}

func (h *DashboardHandler) GetSummary(c *gin.Context) {
	userID, ok := h.getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	summary, err := h.service.GetSummary(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to calculate summary"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": summary})
}

func (h *DashboardHandler) SetBudget(c *gin.Context) {
	userID, ok := h.getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	var input struct {
		Amount float64 `json:"amount" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid amount"})
		return
	}

	budget, err := h.service.SetMonthlyBudget(userID, input.Amount)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to set budget"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": budget, "message": "Budget set for current month"})
}
