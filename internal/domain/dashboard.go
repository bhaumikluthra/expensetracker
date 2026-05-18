package domain

import "time"

type Budget struct {
	ID        uint       `json:"id" gorm:"primaryKey"`
	UserID    uint       `json:"user_id" gorm:"not null;index;default:0"`
	Month     time.Month `json:"month" gorm:"not null"`
	Year      int        `json:"year" gorm:"not null"`
	Amount    float64    `json:"amount" gorm:"not null"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

type DashboardSummary struct {
	TotalSpendThisMonth float64 `json:"total_spend_this_month"`
	TotalSpendToday     float64 `json:"total_spend_today"`
	MonthlyBudgetLeft   float64 `json:"monthly_budget_left"`
	TodaysBudget        float64 `json:"todays_budget"`
}

type DashboardService interface {
	GetSummary(userID uint) (*DashboardSummary, error)
	SetMonthlyBudget(userID uint, amount float64) (*Budget, error)
}
