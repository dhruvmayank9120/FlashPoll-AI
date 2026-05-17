package main

import (
	"bufio"
	"os"
	"strings"
)

type Config struct {
	Port            string
	ClientURL       string
	DatabaseURL     string
	GroqAPIKey string
	NodeEnv         string
}

func loadConfig() Config {
	loadDotEnv(".env")
	loadDotEnv("backend/.env")

	return Config{
		Port:            envDefault("PORT", "5000"),
		ClientURL:       envDefault("CLIENT_URL", "http://localhost:5173"),
		DatabaseURL:     envDefault("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/flashpoll?sslmode=disable"),
		GroqAPIKey: os.Getenv("GROQ_API_KEY"),
		NodeEnv:         envDefault("NODE_ENV", "development"),
	}
}

func envDefault(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func loadDotEnv(path string) {
	file, err := os.Open(path)
	if err != nil {
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.Trim(strings.TrimSpace(value), `"'`)
		if key != "" && os.Getenv(key) == "" {
			_ = os.Setenv(key, value)
		}
	}
}
