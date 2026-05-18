package domain

import "time"

type Category struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	UserID    uint      `json:"user_id" gorm:"not null;index;uniqueIndex:idx_user_category,priority:1"`
	Name      string    `json:"name" gorm:"not null;uniqueIndex:idx_user_category,priority:2"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type CategoryRepository interface {
	Create(category *Category) error
	FindByName(userID uint, name string) (*Category, error)
	Update(category *Category) error
	Delete(id, userID uint) error
	FindAll(userID uint) ([]Category, error)
	FindByID(id, userID uint) (*Category, error)
}

type CategoryService interface {
	CreateCategory(userID uint, name string) (*Category, bool, error)
	GetAllCategories(userID uint) ([]Category, error)
	UpdateCategory(id, userID uint, name string) (*Category, error)
	DeleteCategory(id, userID uint) error
}
