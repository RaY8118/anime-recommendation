package config_test

import (
	"strings"
	"testing"
	"time"

	"github.com/RaY8118/anime-recommendation/backend/go-fetcher/internal/config"
)

// clearEnv unsets every variable Load reads, so a test starts from a known
// state regardless of the developer's shell.
func clearEnv(t *testing.T) {
	t.Helper()
	for _, key := range []string{
		"MONGODB_URI",
		"MONGO_DATABASE",
		"MONGO_COLLECTION",
		"ANILIST_ENDPOINT",
		"ANIME_START_ID",
		"ANIME_TOTAL_ID",
		"ANIME_BATCH_SIZE",
		"FETCH_REQUEST_DELAY",
		"FETCH_REQUEST_TIMEOUT",
		"FETCH_MAX_RETRIES",
		"FETCH_RETRY_BASE_DELAY",
		"MONGO_TIMEOUT",
	} {
		t.Setenv(key, "")
	}
}

func mustLoad(t *testing.T) *config.Config {
	t.Helper()
	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	return cfg
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

func TestLoadAppliesDefaults(t *testing.T) {
	clearEnv(t)
	t.Setenv("MONGODB_URI", "mongodb://localhost:27017")

	cfg := mustLoad(t)

	checks := []struct {
		name string
		got  any
		want any
	}{
		{"MongoURI", cfg.MongoURI, "mongodb://localhost:27017"},
		{"MongoDatabase", cfg.MongoDatabase, config.DefaultDatabase},
		{"MongoCollection", cfg.MongoCollection, config.DefaultCollection},
		{"StartID", cfg.StartID, config.DefaultStartID},
		{"TotalID", cfg.TotalID, config.DefaultTotalID},
		{"BatchSize", cfg.BatchSize, config.DefaultBatchSize},
		{"RequestDelay", cfg.RequestDelay, config.DefaultRequestDelay},
		{"RequestTimeout", cfg.RequestTimeout, config.DefaultRequestTimeout},
		{"MaxRetries", cfg.MaxRetries, config.DefaultMaxRetries},
		{"RetryBase", cfg.RetryBase, config.DefaultRetryBase},
		{"MongoTimeout", cfg.MongoTimeout, config.DefaultMongoTimeout},
	}
	for _, c := range checks {
		if c.got != c.want {
			t.Errorf("%s = %v, want %v", c.name, c.got, c.want)
		}
	}
}

// The defaults must describe a runnable range. If DefaultTotalID ever drops
// below DefaultStartID, an unconfigured run would loop zero times and "succeed".
func TestDefaultRangeIsNonEmpty(t *testing.T) {
	if config.DefaultStartID < 1 {
		t.Errorf("DefaultStartID = %d, want >= 1", config.DefaultStartID)
	}
	if config.DefaultTotalID < config.DefaultStartID {
		t.Errorf("DefaultTotalID = %d, want >= DefaultStartID (%d)",
			config.DefaultTotalID, config.DefaultStartID)
	}
	if config.DefaultBatchSize < 1 || config.DefaultBatchSize > 50 {
		t.Errorf("DefaultBatchSize = %d, want 1..50 (AniList page cap)", config.DefaultBatchSize)
	}
}

func TestLoadReadsEveryOverride(t *testing.T) {
	clearEnv(t)
	t.Setenv("MONGODB_URI", "mongodb://db:27017")
	t.Setenv("MONGO_DATABASE", "other_db")
	t.Setenv("MONGO_COLLECTION", "other_collection")
	t.Setenv("ANILIST_ENDPOINT", "https://example.test/graphql")
	t.Setenv("ANIME_START_ID", "500")
	t.Setenv("ANIME_TOTAL_ID", "900")
	t.Setenv("ANIME_BATCH_SIZE", "25")
	t.Setenv("FETCH_REQUEST_DELAY", "1500ms")
	t.Setenv("FETCH_REQUEST_TIMEOUT", "1m30s")
	t.Setenv("FETCH_MAX_RETRIES", "7")
	t.Setenv("FETCH_RETRY_BASE_DELAY", "500ms")
	t.Setenv("MONGO_TIMEOUT", "45s")

	cfg := mustLoad(t)

	if cfg.MongoDatabase != "other_db" {
		t.Errorf("MongoDatabase = %q", cfg.MongoDatabase)
	}
	if cfg.MongoCollection != "other_collection" {
		t.Errorf("MongoCollection = %q", cfg.MongoCollection)
	}
	if cfg.AniListEndpoint != "https://example.test/graphql" {
		t.Errorf("AniListEndpoint = %q", cfg.AniListEndpoint)
	}
	if cfg.StartID != 500 {
		t.Errorf("StartID = %d, want 500", cfg.StartID)
	}
	if cfg.TotalID != 900 {
		t.Errorf("TotalID = %d, want 900", cfg.TotalID)
	}
	if cfg.BatchSize != 25 {
		t.Errorf("BatchSize = %d, want 25", cfg.BatchSize)
	}
	if cfg.RequestDelay != 1500*time.Millisecond {
		t.Errorf("RequestDelay = %v, want 1.5s", cfg.RequestDelay)
	}
	if cfg.RequestTimeout != 90*time.Second {
		t.Errorf("RequestTimeout = %v, want 1m30s", cfg.RequestTimeout)
	}
	if cfg.MaxRetries != 7 {
		t.Errorf("MaxRetries = %d, want 7", cfg.MaxRetries)
	}
	if cfg.RetryBase != 500*time.Millisecond {
		t.Errorf("RetryBase = %v, want 500ms", cfg.RetryBase)
	}
	if cfg.MongoTimeout != 45*time.Second {
		t.Errorf("MongoTimeout = %v, want 45s", cfg.MongoTimeout)
	}
}

// Every helper treats an empty string as "unset", so a blank value in a .env
// file falls back to the default instead of producing a zero.
func TestLoadTreatsEmptyValuesAsUnset(t *testing.T) {
	clearEnv(t)
	t.Setenv("MONGODB_URI", "mongodb://localhost:27017")
	t.Setenv("MONGO_DATABASE", "")
	t.Setenv("ANIME_BATCH_SIZE", "")
	t.Setenv("FETCH_REQUEST_TIMEOUT", "")

	cfg := mustLoad(t)

	if cfg.MongoDatabase != config.DefaultDatabase {
		t.Errorf("MongoDatabase = %q, want the default", cfg.MongoDatabase)
	}
	if cfg.BatchSize != config.DefaultBatchSize {
		t.Errorf("BatchSize = %d, want the default", cfg.BatchSize)
	}
	if cfg.RequestTimeout != config.DefaultRequestTimeout {
		t.Errorf("RequestTimeout = %v, want the default", cfg.RequestTimeout)
	}
}

func TestLoadRequiresMongoURI(t *testing.T) {
	clearEnv(t)

	_, err := config.Load()
	if err == nil {
		t.Fatal("expected an error when MONGODB_URI is unset")
	}
	if !strings.Contains(err.Error(), "MONGODB_URI") {
		t.Errorf("error %q should name the missing variable", err)
	}
}

func TestLoadRejectsMalformedNumbers(t *testing.T) {
	cases := []struct{ key, value string }{
		{"ANIME_START_ID", "many"},
		{"ANIME_TOTAL_ID", "15000.5"},
		{"ANIME_BATCH_SIZE", "50ids"},
		{"FETCH_MAX_RETRIES", "3.5"},
		{"FETCH_MAX_RETRIES", "0x10"},
	}

	for _, c := range cases {
		t.Run(c.key+"="+c.value, func(t *testing.T) {
			clearEnv(t)
			t.Setenv("MONGODB_URI", "mongodb://localhost:27017")
			t.Setenv(c.key, c.value)

			_, err := config.Load()
			if err == nil {
				t.Fatalf("expected an error for %s=%q", c.key, c.value)
			}
			if !strings.Contains(err.Error(), c.key) {
				t.Errorf("error %q should name %s", err, c.key)
			}
		})
	}
}

func TestLoadRejectsMalformedDurations(t *testing.T) {
	for _, key := range []string{
		"FETCH_REQUEST_DELAY",
		"FETCH_REQUEST_TIMEOUT",
		"FETCH_RETRY_BASE_DELAY",
		"MONGO_TIMEOUT",
	} {
		t.Run(key, func(t *testing.T) {
			clearEnv(t)
			t.Setenv("MONGODB_URI", "mongodb://localhost:27017")
			t.Setenv(key, "3 seconds") // not Go duration syntax

			_, err := config.Load()
			if err == nil {
				t.Fatalf("expected an error for %s=%q", key, "3 seconds")
			}
			if !strings.Contains(err.Error(), key) {
				t.Errorf("error %q should name %s", err, key)
			}
		})
	}
}

// A bare number for a duration is the most likely typo; it must fail loudly
// rather than silently becoming zero.
func TestLoadRejectsBareNumberForDuration(t *testing.T) {
	clearEnv(t)
	t.Setenv("MONGODB_URI", "mongodb://localhost:27017")
	t.Setenv("FETCH_REQUEST_DELAY", "3")

	if _, err := config.Load(); err == nil {
		t.Fatal("expected an error: FETCH_REQUEST_DELAY=3 needs a unit")
	}
}

func TestLoadSurfacesValidationErrors(t *testing.T) {
	clearEnv(t)
	t.Setenv("MONGODB_URI", "mongodb://localhost:27017")
	t.Setenv("ANIME_TOTAL_ID", "10")
	t.Setenv("ANIME_START_ID", "100") // TotalID < StartID

	_, err := config.Load()
	if err == nil {
		t.Fatal("expected Validate to reject the inverted range")
	}
	if !strings.Contains(err.Error(), "ANIME_TOTAL_ID") {
		t.Errorf("error %q should mention the offending variables", err)
	}
}

// ---------------------------------------------------------------------------
// Validate
// ---------------------------------------------------------------------------

// validConfig returns a configuration that passes every check; each test
// mutates exactly one field.
func validConfig() *config.Config {
	return &config.Config{
		MongoURI:        "mongodb://localhost:27017",
		MongoDatabase:   "anime_recommendation",
		MongoCollection: "new_animes",
		MongoTimeout:    30 * time.Second,

		AniListEndpoint: "https://graphql.anilist.co",

		StartID:   10100,
		TotalID:   15000,
		BatchSize: 50,

		RequestDelay:   3 * time.Second,
		RequestTimeout: 30 * time.Second,
		MaxRetries:     3,
		RetryBase:      2 * time.Second,
	}
}

func TestValidateAcceptsAWorkingConfig(t *testing.T) {
	if err := validConfig().Validate(); err != nil {
		t.Fatalf("Validate: %v", err)
	}
}

func TestValidateRejects(t *testing.T) {
	cases := []struct {
		name    string
		mutate  func(*config.Config)
		wantSub string
	}{
		{"empty URI", func(c *config.Config) { c.MongoURI = "" }, "MONGODB_URI"},
		{"empty database", func(c *config.Config) { c.MongoDatabase = "" }, "MONGO_DATABASE"},
		{"empty collection", func(c *config.Config) { c.MongoCollection = "" }, "MONGO_COLLECTION"},
		{"zero start id", func(c *config.Config) { c.StartID = 0 }, "ANIME_START_ID"},
		{"negative start id", func(c *config.Config) { c.StartID = -1 }, "ANIME_START_ID"},
		{"total below start", func(c *config.Config) { c.TotalID = c.StartID - 1 }, "ANIME_TOTAL_ID"},
		{"zero batch size", func(c *config.Config) { c.BatchSize = 0 }, "ANIME_BATCH_SIZE"},
		{"batch size over AniList page cap", func(c *config.Config) { c.BatchSize = 51 }, "ANIME_BATCH_SIZE"},
		{"negative batch size", func(c *config.Config) { c.BatchSize = -5 }, "ANIME_BATCH_SIZE"},
		{"negative delay", func(c *config.Config) { c.RequestDelay = -time.Second }, "FETCH_REQUEST_DELAY"},
		{"zero timeout", func(c *config.Config) { c.RequestTimeout = 0 }, "FETCH_REQUEST_TIMEOUT"},
		{"negative timeout", func(c *config.Config) { c.RequestTimeout = -time.Second }, "FETCH_REQUEST_TIMEOUT"},
		{"negative retries", func(c *config.Config) { c.MaxRetries = -1 }, "FETCH_MAX_RETRIES"},
		{"zero retry base", func(c *config.Config) { c.RetryBase = 0 }, "FETCH_RETRY_BASE_DELAY"},
		{"negative retry base", func(c *config.Config) { c.RetryBase = -time.Second }, "FETCH_RETRY_BASE_DELAY"},
		{"zero mongo timeout", func(c *config.Config) { c.MongoTimeout = 0 }, "MONGO_TIMEOUT"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			cfg := validConfig()
			c.mutate(cfg)

			err := cfg.Validate()
			if err == nil {
				t.Fatalf("Validate accepted %s", c.name)
			}
			if !strings.Contains(err.Error(), c.wantSub) {
				t.Errorf("error %q should mention %s", err, c.wantSub)
			}
		})
	}
}

// Boundary values that must be accepted, so an off-by-one in Validate does not
// reject a legitimate configuration.
func TestValidateAcceptsBoundaries(t *testing.T) {
	cases := []struct {
		name   string
		mutate func(*config.Config)
	}{
		{"start id of 1", func(c *config.Config) { c.StartID = 1; c.TotalID = 1 }},
		{"total equal to start", func(c *config.Config) { c.TotalID = c.StartID }},
		{"batch size of 1", func(c *config.Config) { c.BatchSize = 1 }},
		{"batch size at the page cap", func(c *config.Config) { c.BatchSize = 50 }},
		{"zero delay disables pacing", func(c *config.Config) { c.RequestDelay = 0 }},
		{"zero retries means no retry", func(c *config.Config) { c.MaxRetries = 0 }},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			cfg := validConfig()
			c.mutate(cfg)

			if err := cfg.Validate(); err != nil {
				t.Errorf("Validate rejected %s: %v", c.name, err)
			}
		})
	}
}
