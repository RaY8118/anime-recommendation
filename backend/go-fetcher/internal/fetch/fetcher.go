// Package fetch drives the ingest: it walks the AniList ID range in batches,
// converts each page and persists it incrementally.
package fetch

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/RaY8118/anime-recommendation/backend/go-fetcher/internal/database"
	"github.com/RaY8118/anime-recommendation/backend/go-fetcher/internal/models"
	"github.com/RaY8118/anime-recommendation/backend/go-fetcher/internal/transform"
)

// AniList is the subset of the AniList client the fetcher depends on.
type AniList interface {
	FetchByIDs(ctx context.Context, ids []int) ([]models.GraphQLMedia, error)
}

// Store is the subset of the persistence layer the fetcher depends on.
type Store interface {
	Upsert(ctx context.Context, media []models.Media) (database.WriteResult, error)
}

// Converter turns a page of AniList entries into domain documents.
type Converter func([]models.GraphQLMedia) []models.Media

// Options configures a Fetcher.
type Options struct {
	StartID   int
	TotalID   int
	BatchSize int
	Delay     time.Duration

	// AniList and Store are required.
	AniList AniList
	Store   Store

	// Transform converts fetched entries; it defaults to transform.MediaList.
	Transform Converter

	// Logger receives progress and error records.
	Logger *slog.Logger

	// Sleep waits between batches; it defaults to a context-aware sleep.
	Sleep func(ctx context.Context, d time.Duration) error
}

// Fetcher runs the ingest.
type Fetcher struct {
	opts Options
	log  *slog.Logger
}

// Result summarises a completed run.
type Result struct {
	Batches  int
	Fetched  int
	Upserted int64
	Matched  int64
	Modified int64
	Failed   []FailedBatch
}

// FailedBatch records an ID range that could not be ingested, so a later run
// can backfill exactly what was missed.
type FailedBatch struct {
	StartID int
	EndID   int
	Err     error
}

// New builds a Fetcher.
func New(opts Options) *Fetcher {
	if opts.Transform == nil {
		opts.Transform = transform.MediaList
	}
	if opts.Logger == nil {
		opts.Logger = slog.Default()
	}
	if opts.Sleep == nil {
		opts.Sleep = sleepCtx
	}

	return &Fetcher{opts: opts, log: opts.Logger}
}

// Run walks the configured ID range and ingests every batch.
//
// A batch that fails after its own retries is recorded and skipped rather than
// aborting the run, so one bad range does not discard hours of work. The
// returned Result lists every skipped range.
func (f *Fetcher) Run(ctx context.Context) (Result, error) {
	if f.opts.AniList == nil || f.opts.Store == nil {
		return Result{}, fmt.Errorf("fetch: AniList client and Store are required")
	}

	result := Result{}
	batchSize := f.opts.BatchSize
	total := f.opts.TotalID

	f.log.Info("starting anime ingest",
		slog.Int("start_id", f.opts.StartID),
		slog.Int("total_id", total),
		slog.Int("batch_size", batchSize),
	)

	for start := f.opts.StartID; start <= total; start += batchSize {
		if err := ctx.Err(); err != nil {
			return result, fmt.Errorf("fetch: cancelled after %d batches: %w", result.Batches, err)
		}

		end := min(start+batchSize-1, total)
		ids := make([]int, 0, end-start+1)
		for id := start; id <= end; id++ {
			ids = append(ids, id)
		}

		entries, err := f.opts.AniList.FetchByIDs(ctx, ids)
		if err != nil {
			f.log.Error("batch failed, skipping",
				slog.Int("start_id", start),
				slog.Int("end_id", end),
				slog.String("error", err.Error()),
			)
			result.Failed = append(result.Failed, FailedBatch{StartID: start, EndID: end, Err: err})
		} else {
			media := f.opts.Transform(entries)

			write, writeErr := f.opts.Store.Upsert(ctx, media)
			if writeErr != nil {
				f.log.Error("batch write failed, skipping",
					slog.Int("start_id", start),
					slog.Int("end_id", end),
					slog.String("error", writeErr.Error()),
				)
				result.Failed = append(result.Failed, FailedBatch{StartID: start, EndID: end, Err: writeErr})
			} else {
				result.Batches++
				result.Fetched += len(media)
				result.Upserted += write.Upserted
				result.Matched += write.Matched
				result.Modified += write.Modified

				f.log.Info("batch ingested",
					slog.Int("start_id", start),
					slog.Int("end_id", end),
					slog.Int("returned", len(media)),
					slog.Int("requested", len(ids)),
					slog.Int64("upserted", write.Upserted),
					slog.Int64("matched", write.Matched),
					slog.Int64("modified", write.Modified),
				)
			}
		}

		// Pause before the next batch to stay within the AniList rate limit.
		if end < total && f.opts.Delay > 0 {
			if err := f.opts.Sleep(ctx, f.opts.Delay); err != nil {
				return result, fmt.Errorf("fetch: interrupted while waiting between batches: %w", err)
			}
		}
	}

	f.log.Info("finished anime ingest",
		slog.Int("batches", result.Batches),
		slog.Int("fetched", result.Fetched),
		slog.Int64("upserted", result.Upserted),
		slog.Int64("matched", result.Matched),
		slog.Int64("modified", result.Modified),
		slog.Int("failed_batches", len(result.Failed)),
	)

	return result, nil
}

func sleepCtx(ctx context.Context, d time.Duration) error {
	timer := time.NewTimer(d)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}
