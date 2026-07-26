package config

import (
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

const (
	EnvDevelopment = "development"
	EnvProduction  = "production"

	// Sentinel value: refuse to boot in production while the secret is still this.
	insecureJWTSecret = "super-secret-key-change-in-prod"
)

type Config struct {
	Env            string
	DatabaseURL    string
	ServerPort     string
	GoogleClient   string
	JWTSecret      string
	AllowedOrigins []string
	EnableDevLogin bool
	AutoMigrate    bool
	// AdminEmails is the allowlist of Google account emails that are granted
	// admin rights on login. Everyone else is a normal user.
	AdminEmails []string
	// DefaultSeason is the F1 season the schedule/standings default to.
	DefaultSeason int
}

// IsAdminEmail reports whether the given email should be granted admin rights.
func (c *Config) IsAdminEmail(email string) bool {
	email = strings.ToLower(strings.TrimSpace(email))
	for _, a := range c.AdminEmails {
		if strings.ToLower(a) == email {
			return true
		}
	}
	return false
}

func (c *Config) IsProduction() bool {
	return c.Env == EnvProduction
}

func LoadConfig() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, relying on environment variables")
	}

	env := getEnv("APP_ENV", EnvDevelopment)

	cfg := &Config{
		Env:            env,
		DatabaseURL:    getEnv("DATABASE_URL", "postgres://postgres:password@localhost:5432/banker_lapp?sslmode=disable"),
		ServerPort:     getEnv("PORT", "8080"),
		GoogleClient:   getEnv("GOOGLE_CLIENT_ID", ""),
		JWTSecret:      getEnv("JWT_SECRET", insecureJWTSecret),
		AllowedOrigins: splitAndTrim(getEnv("ALLOWED_ORIGINS", "*")),
		// The dev login mints an admin session without any credentials. It is
		// opt-in outside development and can never be switched on in production.
		EnableDevLogin: getBool("ENABLE_DEV_LOGIN", env != EnvProduction),
		AutoMigrate:    getBool("AUTO_MIGRATE", true),
		AdminEmails:    splitAndTrim(getEnv("ADMIN_EMAILS", "")),
		DefaultSeason:  getInt("DEFAULT_SEASON", 2026),
	}

	cfg.validate()
	return cfg
}

// validate stops the process rather than letting an unsafe production
// configuration reach the network.
func (c *Config) validate() {
	if !c.IsProduction() {
		if c.EnableDevLogin {
			log.Println("WARNING: dev login (/auth/dev) is ENABLED - it grants admin access without credentials")
		}
		return
	}

	var problems []string

	if c.JWTSecret == insecureJWTSecret || len(c.JWTSecret) < 32 {
		problems = append(problems, "JWT_SECRET must be set to a unique value of at least 32 characters")
	}
	if c.GoogleClient == "" {
		problems = append(problems, "GOOGLE_CLIENT_ID must be set (Google Sign-In is the only production login)")
	}
	if len(c.AdminEmails) == 0 {
		problems = append(problems, "ADMIN_EMAILS must list at least one admin account email")
	}
	if strings.HasPrefix(c.DatabaseURL, "postgres://postgres:password@localhost") {
		problems = append(problems, "DATABASE_URL still points at the local development database")
	}

	if c.EnableDevLogin {
		log.Println("APP_ENV=production: forcing ENABLE_DEV_LOGIN off")
		c.EnableDevLogin = false
	}

	if len(problems) > 0 {
		for _, p := range problems {
			log.Printf("FATAL config error: %s", p)
		}
		log.Fatal("refusing to start in production with an unsafe configuration")
	}
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists && value != "" {
		return value
	}
	return fallback
}

func getBool(key string, fallback bool) bool {
	value, exists := os.LookupEnv(key)
	if !exists {
		return fallback
	}
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return fallback
	}
}

func getInt(key string, fallback int) int {
	if value, exists := os.LookupEnv(key); exists {
		if n, err := strconv.Atoi(strings.TrimSpace(value)); err == nil {
			return n
		}
	}
	return fallback
}

func splitAndTrim(value string) []string {
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}
