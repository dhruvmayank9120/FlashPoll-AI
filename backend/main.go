package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func main() {
	cfg := loadConfig()

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	store, err := NewStore(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database startup error: %v", err)
	}
	defer store.Close()

	broker := NewBroker()
	handler := NewHandler(store, broker, cfg)

	mux := http.NewServeMux()
	handler.Register(mux)
	registerStatic(mux)

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           withLogging(withCORS(mux, cfg)),
		ReadHeaderTimeout: 5 * time.Second,
	}

	fmt.Println()
	fmt.Printf("Flash-Poll Go API -> http://localhost:%s\n", cfg.Port)
	fmt.Printf("Database          -> PostgreSQL\n")
	fmt.Printf("AI assistant       -> %s\n", map[bool]string{true: "Active", false: "Inactive"}[cfg.GroqAPIKey != ""])
	fmt.Println()

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}

func withCORS(next http.Handler, cfg Config) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		allowedOrigin := cfg.ClientURL
		if origin != "" && (origin == cfg.ClientURL || strings.HasPrefix(origin, "http://localhost:")) {
			allowedOrigin = origin
		}

		w.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/api/polls/stream") {
			log.Printf("%s %s", r.Method, r.URL.Path)
		}
		next.ServeHTTP(w, r)
	})
}

func registerStatic(mux *http.ServeMux) {
	staticDir := firstExistingDir("dist", filepath.Join("..", "frontend", "dist"), filepath.Join("frontend", "dist"))
	if staticDir == "" {
		return
	}

	fileServer := http.FileServer(http.Dir(staticDir))
	mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			cleanPath := strings.TrimPrefix(filepath.Clean(r.URL.Path), string(filepath.Separator))
			cleanPath = strings.TrimPrefix(cleanPath, "/")
			candidate := filepath.Join(staticDir, cleanPath)
			if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
				fileServer.ServeHTTP(w, r)
				return
			}
		}
		http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
	})
}

func firstExistingDir(paths ...string) string {
	for _, path := range paths {
		if info, err := os.Stat(path); err == nil && info.IsDir() {
			return path
		}
	}
	return ""
}
