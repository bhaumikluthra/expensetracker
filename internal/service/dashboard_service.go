package service

import (
	"personal-expense-tracker/internal/domain"
	"time"

	"gorm.io/gorm"
)

type dashboardService struct {
	db          *gorm.DB
	expenseRepo domain.ExpenseRepository
}

func NewDashboardService(db *gorm.DB, expenseRepo domain.ExpenseRepository) domain.DashboardService {
	return &dashboardService{db: db, expenseRepo: expenseRepo}
}

func (s *dashboardService) SetMonthlyBudget(userID uint, amount float64) (*domain.Budget, error) {
	now := time.Now()
	budget := domain.Budget{
		UserID: userID,
		Month:  now.Month(),
		Year:   now.Year(),
		Amount: amount,
	}

	err := s.db.Where("user_id = ? AND month = ? AND year = ?", userID, now.Month(), now.Year()).
		Assign(domain.Budget{Amount: amount}).
		FirstOrCreate(&budget).Error

	return &budget, err
}

func (s *dashboardService) GetSummary(userID uint) (*domain.DashboardSummary, error) {
	now := time.Now()

	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	endOfMonth := startOfMonth.AddDate(0, 1, -1).Add(23*time.Hour + 59*time.Minute + 59*time.Second)

	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	endOfDay := startOfDay.Add(23*time.Hour + 59*time.Minute + 59*time.Second)

	spendThisMonth, _ := s.expenseRepo.GetTotalSpend(userID, startOfMonth, endOfMonth)
	spendToday, _ := s.expenseRepo.GetTotalSpend(userID, startOfDay, endOfDay)

	var budget domain.Budget

	// THE FIX: Using Limit(1).Find avoids the "record not found" log spam
	// while still safely retrieving the budget if it exists.
	err := s.db.Where("user_id = ? AND month = ? AND year = ?", userID, now.Month(), now.Year()).
		Limit(1).
		Find(&budget).Error

	if err != nil {
		return nil, err // Only catches actual database failures, not empty results
	}

	budgetLeft := 0.0
	todaysBudget := 0.0

	// If no budget was found, budget.Amount is safely 0.0
	if budget.Amount > 0 {
		budgetLeft = budget.Amount - spendThisMonth

		daysInMonth := endOfMonth.Day()
		daysRemaining := float64(daysInMonth - now.Day() + 1) // +1 to include today

		if budgetLeft > 0 {
			todaysBudget = budgetLeft / daysRemaining
		}
	}

	return &domain.DashboardSummary{
		TotalSpendThisMonth: spendThisMonth,
		TotalSpendToday:     spendToday,
		MonthlyBudgetLeft:   budgetLeft,
		TodaysBudget:        todaysBudget,
	}, nil
}
