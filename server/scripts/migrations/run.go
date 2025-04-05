// scripts/migrations/run.go
package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"

	_ "github.com/jackc/pgx/v4/stdlib"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables
	err := godotenv.Load("configs/app.env")
	if err != nil {
		log.Println("Warning: .env file not found, using environment variables")
	}

	// Connect to database
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		os.Getenv("DB_HOST"),
		os.Getenv("DB_PORT"),
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_NAME"),
		os.Getenv("DB_SSLMODE"),
	)

	db, err := sql.Open("pgx", connStr)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Check connection
	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}

	// Create migrations table if it doesn't exist
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS migrations (
			id SERIAL PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)
	`)
	if err != nil {
		log.Fatalf("Failed to create migrations table: %v", err)
	}

	// Get all migration files
	files, err := filepath.Glob("scripts/migrations/*.sql")
	if err != nil {
		log.Fatalf("Failed to find migration files: %v", err)
	}

	// Sort files by name
	for _, file := range files {
		filename := filepath.Base(file)

		// Check if migration has already been applied
		var count int
		err := db.QueryRow("SELECT COUNT(*) FROM migrations WHERE name = $1", filename).Scan(&count)
		if err != nil {
			log.Fatalf("Failed to check migration status: %v", err)
		}

		if count > 0 {
			log.Printf("Migration %s has already been applied", filename)
			continue
		}

		// Read migration file
		content, err := os.ReadFile(file)
		if err != nil {
			log.Fatalf("Failed to read migration file %s: %v", filename, err)
		}

		// Apply migration
		log.Printf("Applying migration %s", filename)
		_, err = db.Exec(string(content))
		if err != nil {
			log.Fatalf("Failed to apply migration %s: %v", filename, err)
		}

		// Record migration
		_, err = db.Exec("INSERT INTO migrations (name) VALUES ($1)", filename)
		if err != nil {
			log.Fatalf("Failed to record migration %s: %v", filename, err)
		}

		log.Printf("Migration %s applied successfully", filename)
	}

	log.Println("All migrations applied successfully")
}
