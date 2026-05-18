package repository

import (
	"personal-expense-tracker/internal/domain"
	"time"

	"gorm.io/gorm"
)

type expenseRepository struct {
	db *gorm.DB
}

func NewExpenseRepository(db *gorm.DB) domain.ExpenseRepository {
	return &expenseRepository{db: db}
}

func (r *expenseRepository) Create(expense *domain.Expense) error {
	return r.db.Create(expense).Error
}

func (r *expenseRepository) FindAll(userID uint) ([]domain.Expense, error) {
	var expenses []domain.Expense
	err := r.db.Preload("Category").Where("user_id = ?", userID).Find(&expenses).Error
	return expenses, err
}

func (r *expenseRepository) GetTotalSpend(userID uint, startDate, endDate time.Time) (float64, error) {
	var total float64
	err := r.db.Model(&domain.Expense{}).
		Where("user_id = ? AND date >= ? AND date <= ?", userID, startDate, endDate).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&total).Error
	return total, err
}

func (r *expenseRepository) FindByID(id, userID uint) (*domain.Expense, error) {
	var expense domain.Expense
	err := r.db.Preload("Category").Where("id = ? AND user_id = ?", id, userID).First(&expense).Error
	return &expense, err
}

func (r *expenseRepository) Update(expense *domain.Expense) error {
	return r.db.Save(expense).Error
}

func (r *expenseRepository) Delete(id, userID uint) error {
	return r.db.Where("id = ? AND user_id = ?", id, userID).Delete(&domain.Expense{}).Error
}

func (r *expenseRepository) DeleteAll(userID uint) error {
	return r.db.Where("user_id = ?", userID).Delete(&domain.Expense{}).Error
}
