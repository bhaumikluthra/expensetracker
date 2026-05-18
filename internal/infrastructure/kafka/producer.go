package kafka

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"personal-expense-tracker/internal/domain"

	"github.com/segmentio/kafka-go"
)

type ExpenseProducer struct {
	writer *kafka.Writer
}

func NewExpenseProducer(brokerURL string, topic string) *ExpenseProducer {
	w := &kafka.Writer{
		Addr:         kafka.TCP(brokerURL),
		Topic:        topic,
		Balancer:     &kafka.LeastBytes{},
		BatchTimeout: 10 * time.Millisecond, // Send messages quickly
	}
	return &ExpenseProducer{writer: w}
}

func (p *ExpenseProducer) PublishExpenseImport(expense domain.Expense) error {
	expenseBytes, err := json.Marshal(expense)
	if err != nil {
		return err
	}

	msg := kafka.Message{
		Key:   []byte("csv_import"),
		Value: expenseBytes,
	}

	err = p.writer.WriteMessages(context.Background(), msg)
	if err != nil {
		log.Printf("Failed to write message to Kafka: %v", err)
		return err
	}
	return nil
}

func (p *ExpenseProducer) Close() {
	p.writer.Close()
}
