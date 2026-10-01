// Command fetcher ingests anime metadata from the AniList GraphQL API into
// MongoDB for the anime recommendation backend.
package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/RaY8118/anime-recommendation/backend/go-fetcher/internal/anilist"
	"github.com/RaY8118/anime-recommendation/backend/go-fetcher/internal/config"
	"github.com/RaY8118/anime-recommendation/backend/go-fetcher/internal/database"
	"github.com/RaY8118/anime-recommendation/backend/go-fetcher/internal/fetch"

	"github.com/joho/godotenv"
)

// envFiles are tried in order. The fetcher runs from the repository root, from
// backend/, or from backend/go-fetcher/, so a single hardcoded relative path
// like "../.env" only works from one of them.
var envFiles = []string{".env", "../.env", "backend/.env"}

func main() {
	if err := run(); err != nil {
		slog.Error("fetcher failed", slog.String("error", err.Error()))
		os.Exit(1)
	}
}

func run() error {
	loadEnv()

	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	cfg, err := config.Load()
	if err != nil {
		return err
	}

	// Ctrl-C cancels the run so that the current batch finishes cleanly and
	// the client is disconnected instead of the process dying mid-write.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	client, err := database.Connect(ctx, cfg.MongoURI, cfg.MongoTimeout)
	if err != nil {
		return err
	}
	defer func() {
		disconnectCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), cfg.MongoTimeout)
		defer cancel()
		if err := client.Disconnect(disconnectCtx); err != nil {
			logger.Error("failed to disconnect from MongoDB", slog.String("error", err.Error()))
		}
	}()

	logger.Info("connected to MongoDB",
		slog.String("database", cfg.MongoDatabase),
		slog.String("collection", cfg.MongoCollection),
	)

	apiClient := anilist.New(anilist.Options{
		Endpoint:   cfg.AniListEndpoint,
		Timeout:    cfg.RequestTimeout,
		MaxRetries: cfg.MaxRetries,
		RetryBase:  cfg.RetryBase,
	})

	result, err := fetch.New(fetch.Options{
		StartID:   cfg.StartID,
		TotalID:   cfg.TotalID,
		BatchSize: cfg.BatchSize,
		Delay:     cfg.RequestDelay,

		AniList: apiClient,
		Store:   database.NewStore(client, cfg.MongoDatabase, cfg.MongoCollection),
		Logger:  logger,
	}).Run(ctx)

	report(logger, result)

	if err != nil {
		return err
	}
	if len(result.Failed) > 0 {
		// The run completed with gaps. Exiting non-zero lets a scheduler or CI
		// job notice without discarding the batches that did succeed.
		return fmt.Errorf("%d of the requested batches failed and were skipped", len(result.Failed))
	}

	return nil
}

// report prints a summary, including the ID ranges that need a backfill.
func report(logger *slog.Logger, result fetch.Result) {
	logger.Info("summary",
		slog.Int("batches", result.Batches),
		slog.Int("fetched", result.Fetched),
		slog.Int64("upserted", result.Upserted),
		slog.Int64("matched", result.Matched),
		slog.Int64("modified", result.Modified),
	)

	for _, failed := range result.Failed {
		logger.Warn("skipped range needs a backfill",
			slog.Int("start_id", failed.StartID),
			slog.Int("end_id", failed.EndID),
			slog.String("error", failed.Err.Error()),
		)
	}
}

// loadEnv loads the first .env file it can find. A missing file is not fatal:
// the same values may come from the real environment.
func loadEnv() {
	for _, path := range envFiles {
		if _, err := os.Stat(path); err != nil {
			continue
		}
		if err := godotenv.Load(path); err != nil {
			slog.Warn("failed to load env file", slog.String("path", path), slog.String("error", err.Error()))
			continue
		}
		slog.Debug("loaded env file", slog.String("path", path))
		return
	}
}
