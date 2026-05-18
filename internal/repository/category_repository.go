package repository

import (
	"personal-expense-tracker/internal/domain"
	"strings"

	"gorm.io/gorm"
)

type categoryRepository struct {
	db *gorm.DB
}

func NewCategoryRepository(db *gorm.DB) domain.CategoryRepository {
	return &categoryRepository{db: db}
}

func (r *categoryRepository) Create(category *domain.Category) error {
	return r.db.Create(category).Error
}

func (r *categoryRepository) FindByName(userID uint, name string) (*domain.Category, error) {
	var category domain.Category
	err := r.db.Where("user_id = ? AND LOWER(name) = ?", userID, strings.ToLower(name)).First(&category).Error
	return &category, err
}

func (r *categoryRepository) Update(category *domain.Category) error {
	return r.db.Save(category).Error
}

func (r *categoryRepository) Delete(id, userID uint) error {
	return r.db.Where("id = ? AND user_id = ?", id, userID).Delete(&domain.Category{}).Error
}

func (r *categoryRepository) FindAll(userID uint) ([]domain.Category, error) {
	var categories []domain.Category
	err := r.db.Where("user_id = ?", userID).Find(&categories).Error
	return categories, err
}

func (r *categoryRepository) FindByID(id, userID uint) (*domain.Category, error) {
	var category domain.Category
	err := r.db.Where("id = ? AND user_id = ?", id, userID).First(&category).Error
	return &category, err
}
