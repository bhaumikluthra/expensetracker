package domain

import "time"

type ExpenseQueue interface {
	PublishExpenseImport(expense Expense) error
}
type Expense struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	UserID      uint      `json:"user_id" gorm:"not null;index;default:0"`
	Amount      float64   `json:"amount" gorm:"not null"`
	Description string    `json:"description"`
	Date        time.Time `json:"date" gorm:"not null;default:CURRENT_TIMESTAMP"`
	CategoryID  uint      `json:"category_id" gorm:"not null"`
	Category    Category  `json:"category" gorm:"foreignKey:CategoryID"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type ExpenseRepository interface {
	Create(expense *Expense) error
	FindAll(userID uint) ([]Expense, error)
	GetTotalSpend(userID uint, startDate, endDate time.Time) (float64, error)
	FindByID(id, userID uint) (*Expense, error)
	Update(expense *Expense) error
	Delete(id, userID uint) error
	DeleteAll(userID uint) error
}

type ExpenseService interface {
	CreateExpense(userID uint, amount float64, description string, date time.Time, categoryID uint) (*Expense, error)
	GetAllExpenses(userID uint) ([]Expense, error)
	UpdateExpense(id, userID uint, amount float64, description string, date time.Time, categoryID uint) (*Expense, error)
	DeleteExpense(id, userID uint) error
	DeleteAllExpenses(userID uint) error
}
