// Package config loads and validates the fetcher configuration from the
// environment.
package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

// Defaults matching the original hardcoded values, so an unconfigured run
// behaves exactly as before.
const (
	DefaultDatabase       = "anime_recommendation"
	DefaultCollection     = "new_animes"
	DefaultStartID        = 200
	DefaultTotalID        = 10000
	DefaultBatchSize      = 50
	DefaultRequestDelay   = 3 * time.Second
	DefaultRequestTimeout = 30 * time.Second
	DefaultMaxRetries     = 3
	DefaultRetryBase      = 2 * time.Second
	DefaultMongoTimeout   = 30 * time.Second
)

// Config holds every tunable value used by the fetcher.
type Config struct {
	MongoURI        string
	MongoDatabase   string
	MongoCollection string
	MongoTimeout    time.Duration

	AniListEndpoint string

	StartID   int
	TotalID   int
	BatchSize int

	RequestDelay   time.Duration
	RequestTimeout time.Duration
	MaxRetries     int
	RetryBase      time.Duration
}

// Load reads the configuration from the environment, applying the defaults
// above for anything that is not set. Only MONGODB_URI has no default.
func Load() (*Config, error) {
	cfg := &Config{
		MongoURI:        os.Getenv("MONGODB_URI"),
		MongoDatabase:   envString("MONGO_DATABASE", DefaultDatabase),
		MongoCollection: envString("MONGO_COLLECTION", DefaultCollection),
		AniListEndpoint: os.Getenv("ANILIST_ENDPOINT"),

		StartID:   DefaultStartID,
		TotalID:   DefaultTotalID,
		BatchSize: DefaultBatchSize,

		RequestDelay:   DefaultRequestDelay,
		RequestTimeout: DefaultRequestTimeout,
		MaxRetries:     DefaultMaxRetries,
		RetryBase:      DefaultRetryBase,
		MongoTimeout:   DefaultMongoTimeout,
	}

	var err error

	if cfg.StartID, err = envInt("ANIME_START_ID", cfg.StartID); err != nil {
		return nil, err
	}
	if cfg.TotalID, err = envInt("ANIME_TOTAL_ID", cfg.TotalID); err != nil {
		return nil, err
	}
	if cfg.BatchSize, err = envInt("ANIME_BATCH_SIZE", cfg.BatchSize); err != nil {
		return nil, err
	}
	if cfg.MaxRetries, err = envInt("FETCH_MAX_RETRIES", cfg.MaxRetries); err != nil {
		return nil, err
	}
	if cfg.RequestDelay, err = envDuration("FETCH_REQUEST_DELAY", cfg.RequestDelay); err != nil {
		return nil, err
	}
	if cfg.RequestTimeout, err = envDuration("FETCH_REQUEST_TIMEOUT", cfg.RequestTimeout); err != nil {
		return nil, err
	}
	if cfg.RetryBase, err = envDuration("FETCH_RETRY_BASE_DELAY", cfg.RetryBase); err != nil {
		return nil, err
	}
	if cfg.MongoTimeout, err = envDuration("MONGO_TIMEOUT", cfg.MongoTimeout); err != nil {
		return nil, err
	}

	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

// Validate reports configuration that would produce an incorrect or silently
// truncated run.
func (c *Config) Validate() error {
	if c.MongoURI == "" {
		return fmt.Errorf("config: set MONGODB_URI to your MongoDB connection string")
	}
	if c.MongoDatabase == "" {
		return fmt.Errorf("config: MONGO_DATABASE must not be empty")
	}
	if c.MongoCollection == "" {
		return fmt.Errorf("config: MONGO_COLLECTION must not be empty")
	}
	if c.StartID < 1 {
		return fmt.Errorf("config: ANIME_START_ID must be at least 1, got %d", c.StartID)
	}
	if c.TotalID < c.StartID {
		return fmt.Errorf("config: ANIME_TOTAL_ID (%d) must be at least ANIME_START_ID (%d)", c.TotalID, c.StartID)
	}
	// AniList caps a media page at 50 entries. A larger batch would not be
	// rejected, it would simply be truncated by the server's default page
	// size, so fail loudly instead of storing partial data.
	if c.BatchSize < 1 || c.BatchSize > 50 {
		return fmt.Errorf("config: ANIME_BATCH_SIZE must be between 1 and 50, got %d", c.BatchSize)
	}
	if c.RequestDelay < 0 {
		return fmt.Errorf("config: FETCH_REQUEST_DELAY must not be negative")
	}
	if c.RequestTimeout <= 0 {
		return fmt.Errorf("config: FETCH_REQUEST_TIMEOUT must be positive")
	}
	if c.MaxRetries < 0 {
		return fmt.Errorf("config: FETCH_MAX_RETRIES must not be negative")
	}
	if c.RetryBase <= 0 {
		return fmt.Errorf("config: FETCH_RETRY_BASE_DELAY must be positive")
	}
	if c.MongoTimeout <= 0 {
		return fmt.Errorf("config: MONGO_TIMEOUT must be positive")
	}

	return nil
}

func envString(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func envInt(key string, fallback int) (int, error) {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback, nil
	}

	value, err := strconv.Atoi(raw)
	if err != nil {
		return 0, fmt.Errorf("config: %s must be an integer: %w", key, err)
	}
	return value, nil
}

func envDuration(key string, fallback time.Duration) (time.Duration, error) {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback, nil
	}

	value, err := time.ParseDuration(raw)
	if err != nil {
		return 0, fmt.Errorf("config: %s must be a duration such as 3s or 1m30s: %w", key, err)
	}
	return value, nil
}
