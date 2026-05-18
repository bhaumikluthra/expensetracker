package service

import (
	"errors"
	"personal-expense-tracker/internal/domain"
	"strings"
)

type categoryService struct {
	repo domain.CategoryRepository
}

func NewCategoryService(repo domain.CategoryRepository) domain.CategoryService {
	return &categoryService{repo: repo}
}

func (s *categoryService) CreateCategory(userID uint, name string) (*domain.Category, bool, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, false, errors.New("category name cannot be empty")
	}

	// Check if category already exists (case-insensitive)
	if existing, err := s.repo.FindByName(userID, name); err == nil && existing != nil && existing.ID != 0 {
		return existing, false, nil
	}

	category := &domain.Category{
		UserID: userID,
		Name:   name,
	}

	err := s.repo.Create(category)
	if err != nil {
		// Possible race / unique constraint hit: try to find existing and return it
		if existing, findErr := s.repo.FindByName(userID, name); findErr == nil && existing != nil && existing.ID != 0 {
			return existing, false, nil
		}
		return nil, false, err
	}

	return category, true, nil
}

func (s *categoryService) GetAllCategories(userID uint) ([]domain.Category, error) {
	return s.repo.FindAll(userID)
}

func (s *categoryService) UpdateCategory(id, userID uint, name string) (*domain.Category, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, errors.New("category name cannot be empty")
	}

	// fetch existing
	cat, err := s.repo.FindByID(id, userID)
	if err != nil {
		return nil, err
	}

	// check for name conflict with another category
	if existing, err := s.repo.FindByName(userID, name); err == nil && existing != nil && existing.ID != 0 && existing.ID != cat.ID {
		return existing, errors.New("category with this name already exists")
	}

	cat.Name = name
	if err := s.repo.Update(cat); err != nil {
		return nil, err
	}
	return cat, nil
}

func (s *categoryService) DeleteCategory(id, userID uint) error {
	err := s.repo.Delete(id, userID)
	if err != nil {
		// Detect foreign key constraint violation and return friendly message
		if strings.Contains(strings.ToLower(err.Error()), "foreign key") || strings.Contains(err.Error(), "23503") {
			return errors.New("cannot delete category with existing expenses")
		}
		return err
	}
	return nil
}
