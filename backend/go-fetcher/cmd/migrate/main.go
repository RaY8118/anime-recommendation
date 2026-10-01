// Command migrate repairs the anime documents written by the original
// go-fetcher, which persisted lower-cased field names that the Python API does
// not read.
//
// It runs in dry-run mode by default. Pass -apply to write changes.
//
//	# inspect what would change
//	go run ./cmd/migrate
//
//	# perform the repair
//	go run ./cmd/migrate -apply
package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/RaY8118/anime-recommendation/backend/go-fetcher/internal/database"
	"github.com/RaY8118/anime-recommendation/backend/go-fetcher/internal/migrate"

	"github.com/joho/godotenv"
)

func main() {
	if err := run(); err != nil {
		slog.Error("migration failed", slog.String("error", err.Error()))
		os.Exit(1)
	}
}

func run() error {
	apply := flag.Bool("apply", false, "write changes to MongoDB; without this flag nothing is modified")
	skipDedup := flag.Bool("skip-dedup", false, "leave duplicate anime documents in place")
	skipHTML := flag.Bool("skip-html", false, "leave HTML markup in descriptions")
	skipIndexes := flag.Bool("skip-indexes", false, "do not create indexes")
	flag.Parse()

	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	loadEnv()

	uri := os.Getenv("MONGODB_URI")
	if uri == "" {
		return fmt.Errorf("set MONGODB_URI to your MongoDB connection string")
	}

	dbName := envOr("MONGO_DATABASE", "anime_recommendation")
	collectionName := envOr("MONGO_COLLECTION", "new_animes")

	ctx := context.Background()

	client, err := database.Connect(ctx, uri, 30*time.Second)
	if err != nil {
		return err
	}
	defer func() {
		disconnectCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		_ = client.Disconnect(disconnectCtx)
	}()

	collection := client.Database(dbName).Collection(collectionName)
	renamer := migrate.NewRenamer(collection)
	deduper := migrate.NewDeduplicator(collection)
	cleaner := migrate.NewHTMLCleaner(collection)
	indexer := migrate.NewIndexManager(collection)

	plan, err := renamer.Inspect(ctx)
	if err != nil {
		return err
	}

	duplicates, err := deduper.InspectDuplicateIDs(ctx)
	if err != nil {
		return err
	}

	htmlCount, err := cleaner.Matches(ctx)
	if err != nil {
		return err
	}

	existingIndexes, err := indexer.Inspect(ctx)
	if err != nil {
		return err
	}

	logger.Info("migration plan",
		slog.String("target", dbName+"."+collectionName),
		slog.Int64("documents", plan.Total),
		slog.Int64("renames_needed", sumValues(plan.Renamed)),
		slog.Int("duplicate_ids", len(duplicates)),
		slog.Int64("descriptions_with_html", htmlCount),
		slog.Any("existing_indexes", existingIndexes),
		slog.Bool("apply", *apply),
	)

	for _, rename := range migrate.Renames {
		logger.Info("  rename",
			slog.String("from", rename.From),
			slog.String("to", rename.To),
			slog.Int64("documents", plan.Renamed[rename.From]),
		)
	}
	for _, duplicate := range duplicates {
		logger.Warn("  duplicate anime id",
			slog.Int64("anime_id", duplicate.AnimeID),
			slog.Int64("documents", duplicate.Count),
		)
	}

	if !*apply {
		logger.Info("dry run complete, nothing was modified", slog.String("hint", "re-run with -apply"))
		return nil
	}

	stepCtx, cancel := migrate.StepContext(ctx)
	defer cancel()

	renamed, err := renamer.Run(stepCtx)
	if err != nil {
		return err
	}
	for from, count := range renamed {
		logger.Info("renamed field", slog.String("from", from), slog.Int64("documents", count))
	}

	var deleted int64
	if !*skipDedup {
		deleted, err = deduper.Run(stepCtx)
		if err != nil {
			return err
		}
		logger.Info("removed duplicate documents", slog.Int64("count", deleted))
	} else {
		logger.Info("skipping deduplication")
	}

	var cleaned int64
	if !*skipHTML {
		cleaned, err = cleaner.Run(stepCtx)
		if err != nil {
			return err
		}
		logger.Info("cleaned description HTML", slog.Int64("count", cleaned))
	} else {
		logger.Info("skipping description cleanup")
	}

	var createdIndexes []string
	if !*skipIndexes {
		// The unique index requires the duplicates to be gone first.
		createdIndexes, err = indexer.Create(stepCtx, !*skipDedup)
		if err != nil {
			return err
		}
		logger.Info("created indexes", slog.Any("indexes", createdIndexes))
	} else {
		logger.Info("skipping index creation")
	}

	fmt.Print("\n" + migrate.Report(plan.Total, renamed, deleted, cleaned, createdIndexes))
	logger.Info("migration complete")

	return nil
}

func loadEnv() {
	for _, path := range []string{".env", "../.env", "backend/.env"} {
		if _, err := os.Stat(path); err != nil {
			continue
		}
		if err := godotenv.Load(path); err != nil {
			continue
		}
		return
	}
}

func envOr(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func sumValues(counts map[string]int64) int64 {
	var total int64
	for _, count := range counts {
		total += count
	}
	return total
}
