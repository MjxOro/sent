// internal/config/config.go
package config

import "os"

// Config holds all application configuration
type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	Redis    RedisConfig
	OAuth    OAuthConfig
}

// ServerConfig contains server related settings
type ServerConfig struct {
	Port string
}

// DatabaseConfig contains database settings
type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
	SSLMode  string
}

// RedisConfig contains Redis settings
type RedisConfig struct {
	Host     string
	Port     string
	Password string
	DB       int
}

// OAuthConfig contains OAuth provider settings
type OAuthConfig struct {
	ProviderName string
	ClientID     string
	ClientSecret string
	RedirectURL  string
	AuthURL      string
	TokenURL     string
	UserInfoURL  string
	Scopes       []string
}

// Load returns application configuration
func Load() *Config {
	return &Config{
		Server: ServerConfig{
			Port: getEnv("PORT", "8080"),
		},
		Database: DatabaseConfig{
			Host:     getEnv("POSTGRES_HOST", "localhost"),
			Port:     getEnv("POSTGRES_PORT", "5432"),
			User:     getEnv("POSTGRES_USER", "postgres"),
			Password: getEnv("POSTGRES_PASSWORD", "postgres"),
			DBName:   getEnv("POSTGRES_DB", "chatapp"),
			SSLMode:  getEnv("POSTGRES_SSLMODE", "disable"),
		},
		Redis: RedisConfig{
			Host:     getEnv("REDIS_HOST", "localhost"),
			Port:     getEnv("REDIS_PORT", "6379"),
			Password: getEnv("REDIS_PASSWORD", ""),
			DB:       0,
		},
		OAuth: OAuthConfig{
			ProviderName: getEnv("OAUTH_PROVIDER_NAME", "google"),
			ClientID:     getEnv("OAUTH_CLIENT_ID", ""),
			ClientSecret: getEnv("OAUTH_CLIENT_SECRET", ""),
			RedirectURL:  getEnv("OAUTH_REDIRECT_URL", "http://localhost:8080/api/auth/callback"),
			AuthURL:      getEnv("OAUTH_AUTH_URL", "https://accounts.google.com/o/oauth2/auth"),
			TokenURL:     getEnv("OAUTH_TOKEN_URL", "https://oauth2.googleapis.com/token"),
			UserInfoURL:  getEnv("OAUTH_USERINFO_URL", "https://www.googleapis.com/oauth2/v3/userinfo"),
			Scopes:       []string{"profile", "email"},
		},
	}
}

// Helper function to get environment variables with a default value
func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}
