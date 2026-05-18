package database

import (
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func ConnectDB() *gorm.DB {
	err := godotenv.Load()
	if err != nil {
		log.Println("Warning: Error loading .env file")
	}

	host := os.Getenv("DB_HOST")
	if host == "" {
		host = os.Getenv("RDSHOST")
	}

	sslRootCert := os.Getenv("DB_SSLROOTCERT")
	sslMode := os.Getenv("DB_SSLMODE")
	if sslMode == "" {
		if sslRootCert != "" {
			sslMode = "verify-full"
		} else {
			sslMode = "disable"
		}
	}

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=%s TimeZone=UTC",
		host,
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_NAME"),
		os.Getenv("DB_PORT"),
		sslMode,
	)

	if sslRootCert != "" {
		dsn = fmt.Sprintf("%s sslrootcert=%s", dsn, sslRootCert)
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	log.Println("Database connection established successfully!")
	return db
}
