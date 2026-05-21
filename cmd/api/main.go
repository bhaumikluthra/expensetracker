package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"personal-expense-tracker/internal/domain"
	"personal-expense-tracker/internal/handler"
	"personal-expense-tracker/internal/middleware"
	"personal-expense-tracker/internal/repository"
	"personal-expense-tracker/internal/service"
	"personal-expense-tracker/pkg/database"

	"personal-expense-tracker/internal/infrastructure/gemini"
	"personal-expense-tracker/internal/infrastructure/kafka"
	"personal-expense-tracker/internal/worker"
)

func main() {
	db := database.ConnectDB()

	log.Println("Running database migrations...")
	err := db.AutoMigrate(&domain.User{}, &domain.Category{}, &domain.Expense{}, &domain.Budget{})
	if err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	brokerURL := "localhost:9092"
	topic := "expense_imports"

	// 1. Initialize Kafka Producer (for sending tasks)
	kafkaProducer := kafka.NewExpenseProducer(brokerURL, topic)
	defer kafkaProducer.Close() // Ensures connection closes when app shuts down

	// 2. Initialize and Start Kafka Consumer (Worker) in the background
	kafkaConsumer := worker.NewExpenseConsumer(brokerURL, topic, "expense_group_1", db)
	defer kafkaConsumer.Close()

	// Start the worker loop concurrently so it doesn't block the API
	go kafkaConsumer.Start()
	// ==========================================

	authHandler := handler.NewAuthHandler(db)
	categoryRepo := repository.NewCategoryRepository(db)
	categoryService := service.NewCategoryService(categoryRepo)
	categoryHandler := handler.NewCategoryHandler(categoryService)

	expenseRepo := repository.NewExpenseRepository(db)
	expenseService := service.NewExpenseService(expenseRepo)

	// UPDATED: Pass the kafkaProducer into your Expense Handler so it can drop messages into the queue
	expenseHandler := handler.NewExpenseHandler(expenseService, kafkaProducer)

	geminiClient := gemini.NewClient()
	csvImportService := service.NewCSVImportService(geminiClient, expenseService, categoryService)
	importHandler := handler.NewImportHandler(csvImportService)

	dashboardService := service.NewDashboardService(db, expenseRepo)
	dashboardHandler := handler.NewDashboardHandler(dashboardService)

	router := gin.Default()

	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "http://localhost:3000", "http://3.26.43.204:5173"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	api := router.Group("/api/v1")
	{
		api.GET("/health", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"status": "UP"})
		})

		auth := api.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
		}

		protected := api.Group("/")
		protected.Use(middleware.AuthMiddleware())
		{
			protected.POST("/categories", categoryHandler.CreateCategory)
			protected.GET("/categories", categoryHandler.GetAllCategories)
			protected.PUT("/categories/:id", categoryHandler.UpdateCategory)
			protected.DELETE("/categories/:id", categoryHandler.DeleteCategory)

			protected.POST("/expenses", expenseHandler.CreateExpense) // Standard synchronous save
			protected.POST("/expenses/import-csv", importHandler.ImportCSV)
			protected.GET("/expenses", expenseHandler.GetAllExpenses)
			protected.DELETE("/expenses", expenseHandler.DeleteAllExpenses)

			protected.GET("/dashboard/summary", dashboardHandler.GetSummary)
			protected.POST("/dashboard/budget", dashboardHandler.SetBudget)

			protected.PUT("/expenses/:id", expenseHandler.UpdateExpense)
			protected.DELETE("/expenses/:id", expenseHandler.DeleteExpense)
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Starting server on port %s...\n", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
