package worker

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"personal-expense-tracker/internal/domain"

	"github.com/segmentio/kafka-go"
	"gorm.io/gorm"
)

type ExpenseConsumer struct {
	reader *kafka.Reader
	db     *gorm.DB
}

func NewExpenseConsumer(brokerURL, topic, groupID string, db *gorm.DB) *ExpenseConsumer {
	r := kafka.NewReader(kafka.ReaderConfig{
		Brokers:  []string{brokerURL},
		GroupID:  groupID,
		Topic:    topic,
		MinBytes: 10e3, // 10KB
		MaxBytes: 10e6, // 10MB
	})
	return &ExpenseConsumer{reader: r, db: db}
}

// Start runs infinitely in a goroutine
func (c *ExpenseConsumer) Start() {
	log.Println("🚀 Kafka Consumer started. Waiting for messages...")
	for {
		msg, err := c.reader.ReadMessage(context.Background())
		if err != nil {
			log.Printf("Error reading message: %v", err)
			// If Kafka isn't reachable, back off to avoid tight error logs
			time.Sleep(2 * time.Second)
			continue
		}

		var expense domain.Expense
		if err := json.Unmarshal(msg.Value, &expense); err != nil {
			log.Printf("Error unmarshaling message: %v", err)
			continue
		}

		// Save to Database safely in the background
		if err := c.db.Create(&expense).Error; err != nil {
			log.Printf("Failed to save expense from Kafka: %v", err)
		} else {
			log.Printf("✅ Worker saved expense: %s (₹%.2f)", expense.Description, expense.Amount)
		}
	}
}

func (c *ExpenseConsumer) Close() {
	c.reader.Close()
}
