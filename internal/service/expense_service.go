package service

import (
	"errors"
	"personal-expense-tracker/internal/domain"
	"time"
)

type expenseService struct {
	repo domain.ExpenseRepository
}

func NewExpenseService(repo domain.ExpenseRepository) domain.ExpenseService {
	return &expenseService{repo: repo}
}

func (s *expenseService) CreateExpense(userID uint, amount float64, description string, date time.Time, categoryID uint) (*domain.Expense, error) {
	if amount <= 0 {
		return nil, errors.New("expense amount must be greater than zero")
	}

	// Enforce an upper limit of 10 crore (100,000,000)
	const maxAmount = 100000000.0
	if amount > maxAmount {
		return nil, errors.New("expense amount must not exceed 100000000 (10 crore)")
	}

	if date.IsZero() {
		date = time.Now()
	}

	expense := &domain.Expense{
		UserID:      userID,
		Amount:      amount,
		Description: description,
		Date:        date,
		CategoryID:  categoryID,
	}

	err := s.repo.Create(expense)
	if err != nil {
		return nil, err
	}

	return expense, nil
}

func (s *expenseService) GetAllExpenses(userID uint) ([]domain.Expense, error) {
	return s.repo.FindAll(userID)
}

func (s *expenseService) UpdateExpense(id, userID uint, amount float64, description string, date time.Time, categoryID uint) (*domain.Expense, error) {
	if amount <= 0 {
		return nil, errors.New("expense amount must be greater than zero")
	}

	// Enforce upper limit on update as well
	const maxAmount = 100000000.0
	if amount > maxAmount {
		return nil, errors.New("expense amount must not exceed 100000000 (10 crore)")
	}

	expense, err := s.repo.FindByID(id, userID)
	if err != nil {
		return nil, errors.New("expense not found")
	}

	expense.Amount = amount
	expense.Description = description
	expense.CategoryID = categoryID
	if !date.IsZero() {
		expense.Date = date
	}

	err = s.repo.Update(expense)
	if err != nil {
		return nil, err
	}

	return expense, nil
}

func (s *expenseService) DeleteExpense(id, userID uint) error {
	return s.repo.Delete(id, userID)
}

func (s *expenseService) DeleteAllExpenses(userID uint) error {
	return s.repo.DeleteAll(userID)
}
