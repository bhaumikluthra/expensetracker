package handler

import (
	"net/http"
	"personal-expense-tracker/internal/domain"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

type CategoryHandler struct {
	service domain.CategoryService
}

func NewCategoryHandler(service domain.CategoryService) *CategoryHandler {
	return &CategoryHandler{service: service}
}

func (h *CategoryHandler) getUserID(c *gin.Context) (uint, bool) {
	value, exists := c.Get("userID")
	if !exists {
		return 0, false
	}

	// FIX: JWT parses numbers as float64. We must safely cast it to uint.
	if floatID, ok := value.(float64); ok {
		return uint(floatID), true
	}

	// Just in case it's already a uint
	if uintID, ok := value.(uint); ok {
		return uintID, true
	}

	return 0, false
}

func (h *CategoryHandler) CreateCategory(c *gin.Context) {
	userID, ok := h.getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	var input struct {
		Name string `json:"name" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	category, created, err := h.service.CreateCategory(userID, input.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if created {
		c.JSON(http.StatusCreated, gin.H{"data": category})
	} else {
		c.JSON(http.StatusOK, gin.H{"data": category})
	}
}

func (h *CategoryHandler) GetAllCategories(c *gin.Context) {
	userID, ok := h.getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	categories, err := h.service.GetAllCategories(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch categories"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": categories})
}

func (h *CategoryHandler) UpdateCategory(c *gin.Context) {
	userID, ok := h.getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid category ID"})
		return
	}

	var input struct {
		Name string `json:"name" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	category, err := h.service.UpdateCategory(uint(id), userID, input.Name)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": category})
}

func (h *CategoryHandler) DeleteCategory(c *gin.Context) {
	userID, ok := h.getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid category ID"})
		return
	}

	if err := h.service.DeleteCategory(uint(id), userID); err != nil {
		// Friendly handling for FK constraint errors coming from DB or service
		if strings.Contains(strings.ToLower(err.Error()), "foreign key") || strings.Contains(err.Error(), "23503") || err.Error() == "cannot delete category with existing expenses" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "cannot delete category with existing expenses"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Category deleted"})
}
