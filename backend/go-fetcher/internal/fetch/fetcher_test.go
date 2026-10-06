package fetch_test

import (
	"context"
	"errors"
	"log/slog"
	"testing"
	"time"

	"github.com/RaY8118/anime-recommendation/backend/go-fetcher/internal/database"
	"github.com/RaY8118/anime-recommendation/backend/go-fetcher/internal/fetch"
	"github.com/RaY8118/anime-recommendation/backend/go-fetcher/internal/models"
)

// ---------------------------------------------------------------------------
// test doubles
// ---------------------------------------------------------------------------

// stubAniList records every ID slice it was asked for and delegates to fetch.
type stubAniList struct {
	calls [][]int
	fetch func(ids []int) ([]models.GraphQLMedia, error)
}

func (s *stubAniList) FetchByIDs(_ context.Context, ids []int) ([]models.GraphQLMedia, error) {
	s.calls = append(s.calls, append([]int(nil), ids...))
	if s.fetch != nil {
		return s.fetch(ids)
	}
	return mediaForIDs(ids), nil
}

// mediaForIDs is the default behaviour: one entry per requested ID.
func mediaForIDs(ids []int) []models.GraphQLMedia {
	out := make([]models.GraphQLMedia, 0, len(ids))
	for _, id := range ids {
		out = append(out, models.GraphQLMedia{ID: id})
	}
	return out
}

func (s *stubAniList) requestedIDs() []int {
	var all []int
	for _, call := range s.calls {
		all = append(all, call...)
	}
	return all
}

// stubStore records every batch it was asked to persist.
type stubStore struct {
	calls  [][]models.Media
	upsert func(media []models.Media) (database.WriteResult, error)
}

func (s *stubStore) Upsert(_ context.Context, media []models.Media) (database.WriteResult, error) {
	s.calls = append(s.calls, media)
	if s.upsert != nil {
		return s.upsert(media)
	}
	// Mirror the real Store: every document is treated as inserted.
	return database.WriteResult{Upserted: int64(len(media))}, nil
}

// recordingSleep captures requested durations instead of waiting.
type recordingSleep struct {
	durations []time.Duration
	err       error
}

func (r *recordingSleep) sleep(_ context.Context, d time.Duration) error {
	r.durations = append(r.durations, d)
	return r.err
}

// quietLogger keeps test output readable; nil Logger falls back to slog.Default.
func quietLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(discard{}, &slog.HandlerOptions{Level: slog.LevelError}))
}

type discard struct{}

func (discard) Write(p []byte) (int, error) { return len(p), nil }

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

// equalInts reports whether two int slices hold the same values in the same order.
func equalInts(a, b []int) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func baseOptions(t *testing.T, anilist *stubAniList, store *stubStore) fetch.Options {
	t.Helper()
	return fetch.Options{
		StartID:   1,
		TotalID:   10,
		BatchSize: 5,
		Delay:     time.Second,
		AniList:   anilist,
		Store:     store,
		Logger:    quietLogger(),
		Sleep:     (&recordingSleep{}).sleep,
	}
}

// ---------------------------------------------------------------------------
// range walking
// ---------------------------------------------------------------------------

func TestRunWalksRangeInBatches(t *testing.T) {
	anilist := &stubAniList{}
	store := &stubStore{}

	opts := baseOptions(t, anilist, store)
	opts.StartID, opts.TotalID, opts.BatchSize = 1, 10, 5

	result, err := fetch.New(opts).Run(context.Background())
	if err != nil {
		t.Fatalf("Run: %v", err)
	}

	want := []int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	if got := anilist.requestedIDs(); !equalInts(got, want) {
		t.Errorf("requested IDs = %v, want %v", got, want)
	}
	if len(anilist.calls) != 2 {
		t.Fatalf("got %d calls, want 2", len(anilist.calls))
	}
	if result.Batches != 2 {
		t.Errorf("Batches = %d, want 2", result.Batches)
	}
	if result.Fetched != 10 {
		t.Errorf("Fetched = %d, want 10", result.Fetched)
	}
	if result.Upserted != 10 {
		t.Errorf("Upserted = %d, want 10", result.Upserted)
	}
	if len(result.Failed) != 0 {
		t.Errorf("Failed = %v, want none", result.Failed)
	}
}

func TestRunClampsFinalBatchToTotalID(t *testing.T) {
	anilist := &stubAniList{}
	store := &stubStore{}

	opts := baseOptions(t, anilist, store)
	opts.StartID, opts.TotalID, opts.BatchSize = 1, 8, 5

	if _, err := fetch.New(opts).Run(context.Background()); err != nil {
		t.Fatalf("Run: %v", err)
	}

	want := []int{1, 2, 3, 4, 5, 6, 7, 8}
	if got := anilist.requestedIDs(); !equalInts(got, want) {
		t.Errorf("requested IDs = %v, want %v (must not exceed TotalID)", got, want)
	}
}

func TestRunSingleBatchSmallerThanBatchSize(t *testing.T) {
	anilist := &stubAniList{}
	store := &stubStore{}

	opts := baseOptions(t, anilist, store)
	opts.StartID, opts.TotalID, opts.BatchSize = 42, 44, 50

	result, err := fetch.New(opts).Run(context.Background())
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	if got := anilist.requestedIDs(); !equalInts(got, []int{42, 43, 44}) {
		t.Errorf("requested IDs = %v, want [42 43 44]", got)
	}
	if result.Batches != 1 {
		t.Errorf("Batches = %d, want 1", result.Batches)
	}
}

func TestRunCountsOnlyEntriesAnilistReturned(t *testing.T) {
	// AniList silently omits IDs that do not exist or are not anime, so a page
	// is routinely shorter than the request. That must not be an error.
	anilist := &stubAniList{
		fetch: func(ids []int) ([]models.GraphQLMedia, error) {
			return mediaForIDs(ids[:1]), nil
		},
	}
	store := &stubStore{}

	opts := baseOptions(t, anilist, store)

	result, err := fetch.New(opts).Run(context.Background())
	if err != nil {
		t.Fatalf("short page must not be an error: %v", err)
	}
	if result.Batches != 2 {
		t.Errorf("Batches = %d, want 2", result.Batches)
	}
	if result.Fetched != 2 {
		t.Errorf("Fetched = %d, want 2 (one per batch)", result.Fetched)
	}
}

func TestRunAggregatesWriteResult(t *testing.T) {
	anilist := &stubAniList{}
	store := &stubStore{
		upsert: func(media []models.Media) (database.WriteResult, error) {
			return database.WriteResult{Matched: 3, Modified: 2}, nil
		},
	}

	opts := baseOptions(t, anilist, store)
	opts.StartID, opts.TotalID, opts.BatchSize = 1, 10, 5

	result, err := fetch.New(opts).Run(context.Background())
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	if result.Matched != 6 {
		t.Errorf("Matched = %d, want 6", result.Matched)
	}
	if result.Modified != 4 {
		t.Errorf("Modified = %d, want 4", result.Modified)
	}
	if result.Upserted != 0 {
		t.Errorf("Upserted = %d, want 0", result.Upserted)
	}
}

// ---------------------------------------------------------------------------
// failure handling
// ---------------------------------------------------------------------------

func TestRunSkipsFailedBatchAndContinues(t *testing.T) {
	failure := errors.New("anilist: giving up after 4 attempts")

	anilist := &stubAniList{
		fetch: func(ids []int) ([]models.GraphQLMedia, error) {
			if ids[0] == 1 {
				return nil, failure
			}
			return mediaForIDs(ids), nil
		},
	}
	store := &stubStore{}

	opts := baseOptions(t, anilist, store)
	opts.StartID, opts.TotalID, opts.BatchSize = 1, 15, 5

	result, err := fetch.New(opts).Run(context.Background())
	if err != nil {
		t.Fatalf("a skipped batch must not fail the run: %v", err)
	}

	if len(result.Failed) != 1 {
		t.Fatalf("Failed = %+v, want exactly 1", result.Failed)
	}
	failed := result.Failed[0]
	if failed.StartID != 1 || failed.EndID != 5 {
		t.Errorf("failed range = %d..%d, want 1..5", failed.StartID, failed.EndID)
	}
	if !errors.Is(failed.Err, failure) {
		t.Errorf("failed.Err = %v, want %v", failed.Err, failure)
	}

	// The failed batch is still attempted, and the batches after it are fetched
	// and stored regardless.
	if result.Batches != 2 {
		t.Errorf("Batches = %d, want 2 (only successful batches count)", result.Batches)
	}
	if len(anilist.calls) != 3 {
		t.Fatalf("made %d calls, want 3 (failed batch is still attempted)", len(anilist.calls))
	}
	want := []int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15}
	if got := anilist.requestedIDs(); !equalInts(got, want) {
		t.Errorf("requested IDs = %v, want %v", got, want)
	}
	if len(store.calls) != 2 {
		t.Errorf("Upsert called %d times, want 2", len(store.calls))
	}
}

func TestRunRecordsFailedWrite(t *testing.T) {
	writeErr := errors.New("database: write timeout")

	anilist := &stubAniList{}
	store := &stubStore{
		upsert: func([]models.Media) (database.WriteResult, error) {
			return database.WriteResult{}, writeErr
		},
	}

	opts := baseOptions(t, anilist, store)
	opts.StartID, opts.TotalID, opts.BatchSize = 1, 10, 5

	result, err := fetch.New(opts).Run(context.Background())
	if err != nil {
		t.Fatalf("a failed write must not fail the run: %v", err)
	}
	if len(result.Failed) != 2 {
		t.Fatalf("Failed = %d batches, want 2", len(result.Failed))
	}
	if !errors.Is(result.Failed[0].Err, writeErr) {
		t.Errorf("Failed[0].Err = %v, want %v", result.Failed[0].Err, writeErr)
	}
	if result.Batches != 0 {
		t.Errorf("Batches = %d, want 0", result.Batches)
	}
}

func TestRunRecordsEverySkippedRange(t *testing.T) {
	anilist := &stubAniList{
		fetch: func(ids []int) ([]models.GraphQLMedia, error) {
			if ids[0]%10 == 1 { // every first batch of a decade fails
				return nil, errors.New("boom")
			}
			return mediaForIDs(ids), nil
		},
	}
	store := &stubStore{}

	opts := baseOptions(t, anilist, store)
	opts.StartID, opts.TotalID, opts.BatchSize = 1, 50, 10

	result, err := fetch.New(opts).Run(context.Background())
	if err != nil {
		t.Fatalf("Run: %v", err)
	}

	want := []int{1, 11, 21, 31, 41}
	if len(result.Failed) != len(want) {
		t.Fatalf("Failed = %d batches, want %d", len(result.Failed), len(want))
	}
	for i, start := range want {
		if result.Failed[i].StartID != start {
			t.Errorf("Failed[%d].StartID = %d, want %d", i, result.Failed[i].StartID, start)
		}
	}
}

// ---------------------------------------------------------------------------
// context cancellation
// ---------------------------------------------------------------------------

func TestRunRejectsCancelledContextBeforeAnyWork(t *testing.T) {
	anilist := &stubAniList{}
	store := &stubStore{}

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	opts := baseOptions(t, anilist, store)

	result, err := fetch.New(opts).Run(ctx)
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("err = %v, want context.Canceled", err)
	}
	if result.Batches != 0 {
		t.Errorf("Batches = %d, want 0", result.Batches)
	}
	if len(anilist.calls) != 0 {
		t.Errorf("made %d requests after cancellation, want 0", len(anilist.calls))
	}
}

func TestRunReturnsPartialResultOnCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Cancel while the first batch is in flight: batch one commits, then the
	// loop notices cancellation before starting batch two.
	anilist := &stubAniList{
		fetch: func(ids []int) ([]models.GraphQLMedia, error) {
			cancel()
			return mediaForIDs(ids), nil
		},
	}
	store := &stubStore{}

	opts := baseOptions(t, anilist, store)
	opts.StartID, opts.TotalID, opts.BatchSize = 1, 20, 5

	result, err := fetch.New(opts).Run(ctx)
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("err = %v, want context.Canceled", err)
	}
	if result.Batches != 1 {
		t.Errorf("Batches = %d, want 1 (partial progress must survive)", result.Batches)
	}
	if result.Fetched != 5 {
		t.Errorf("Fetched = %d, want 5", result.Fetched)
	}
	if len(anilist.calls) != 1 {
		t.Errorf("made %d requests, want 1", len(anilist.calls))
	}
}

func TestRunStopsWhenSleepIsInterrupted(t *testing.T) {
	anilist := &stubAniList{}
	store := &stubStore{}
	sleeper := &recordingSleep{err: context.Canceled}

	opts := baseOptions(t, anilist, store)
	opts.StartID, opts.TotalID, opts.BatchSize = 1, 20, 5
	opts.Sleep = sleeper.sleep

	result, err := fetch.New(opts).Run(context.Background())
	if err == nil {
		t.Fatal("expected an error when the inter-batch wait is interrupted")
	}
	if result.Batches != 1 {
		t.Errorf("Batches = %d, want 1", result.Batches)
	}
	if len(sleeper.durations) != 1 {
		t.Errorf("slept %d times, want 1", len(sleeper.durations))
	}
}

// ---------------------------------------------------------------------------
// pacing
// ---------------------------------------------------------------------------

func TestRunSleepsBetweenBatchesButNotAfterTheLast(t *testing.T) {
	anilist := &stubAniList{}
	store := &stubStore{}
	sleeper := &recordingSleep{}

	opts := baseOptions(t, anilist, store)
	opts.StartID, opts.TotalID, opts.BatchSize = 1, 15, 5
	opts.Delay = 250 * time.Millisecond
	opts.Sleep = sleeper.sleep

	if _, err := fetch.New(opts).Run(context.Background()); err != nil {
		t.Fatalf("Run: %v", err)
	}

	if len(sleeper.durations) != 2 {
		t.Fatalf("slept %d times, want 2 (3 batches => 2 gaps)", len(sleeper.durations))
	}
	for i, d := range sleeper.durations {
		if d != 250*time.Millisecond {
			t.Errorf("sleep[%d] = %v, want 250ms", i, d)
		}
	}
}

func TestRunSleepsAfterAFailedBatchToo(t *testing.T) {
	// A failing batch must not be allowed to hammer the API on the next attempt.
	anilist := &stubAniList{
		fetch: func([]int) ([]models.GraphQLMedia, error) {
			return nil, errors.New("boom")
		},
	}
	store := &stubStore{}
	sleeper := &recordingSleep{}

	opts := baseOptions(t, anilist, store)
	opts.StartID, opts.TotalID, opts.BatchSize = 1, 10, 5
	opts.Sleep = sleeper.sleep

	if _, err := fetch.New(opts).Run(context.Background()); err != nil {
		t.Fatalf("Run: %v", err)
	}
	if len(sleeper.durations) != 1 {
		t.Errorf("slept %d times, want 1", len(sleeper.durations))
	}
}

func TestRunSkipsSleepWhenDelayIsZero(t *testing.T) {
	anilist := &stubAniList{}
	store := &stubStore{}
	sleeper := &recordingSleep{}

	opts := baseOptions(t, anilist, store)
	opts.StartID, opts.TotalID, opts.BatchSize = 1, 20, 5
	opts.Delay = 0
	opts.Sleep = sleeper.sleep

	if _, err := fetch.New(opts).Run(context.Background()); err != nil {
		t.Fatalf("Run: %v", err)
	}
	if len(sleeper.durations) != 0 {
		t.Errorf("slept %d times, want 0", len(sleeper.durations))
	}
}

// ---------------------------------------------------------------------------
// construction and defaults
// ---------------------------------------------------------------------------

func TestRunRequiresAniListAndStore(t *testing.T) {
	t.Run("missing AniList", func(t *testing.T) {
		opts := fetch.Options{StartID: 1, TotalID: 5, BatchSize: 5, Store: &stubStore{}, Logger: quietLogger()}
		if _, err := fetch.New(opts).Run(context.Background()); err == nil {
			t.Fatal("expected an error when AniList is nil")
		}
	})

	t.Run("missing Store", func(t *testing.T) {
		opts := fetch.Options{StartID: 1, TotalID: 5, BatchSize: 5, AniList: &stubAniList{}, Logger: quietLogger()}
		if _, err := fetch.New(opts).Run(context.Background()); err == nil {
			t.Fatal("expected an error when Store is nil")
		}
	})
}

func TestNewDefaultsToTransformMediaList(t *testing.T) {
	description := "<p>Humanity fights.<br/>Survive.</p>"
	anilist := &stubAniList{
		fetch: func(ids []int) ([]models.GraphQLMedia, error) {
			return []models.GraphQLMedia{{ID: ids[0], Description: &description}}, nil
		},
	}
	store := &stubStore{}

	opts := baseOptions(t, anilist, store)
	opts.StartID, opts.TotalID, opts.BatchSize = 1, 1, 1
	opts.Transform = nil // exercise the default

	if _, err := fetch.New(opts).Run(context.Background()); err != nil {
		t.Fatalf("Run: %v", err)
	}
	if len(store.calls) != 1 || len(store.calls[0]) != 1 {
		t.Fatalf("unexpected store calls: %+v", store.calls)
	}
	got := store.calls[0][0]
	if got.Description == nil {
		t.Fatal("description is nil")
	}
	if *got.Description != "Humanity fights. Survive." {
		t.Errorf("description = %q, want the default Transform to have cleaned it", *got.Description)
	}
}

func TestRunUsesSuppliedTransform(t *testing.T) {
	anilist := &stubAniList{}
	store := &stubStore{}

	opts := baseOptions(t, anilist, store)
	opts.StartID, opts.TotalID, opts.BatchSize = 1, 5, 5
	opts.Transform = func(in []models.GraphQLMedia) []models.Media {
		out := make([]models.Media, 0, len(in))
		for _, entry := range in {
			out = append(out, models.Media{ID: entry.ID * 100})
		}
		return out
	}

	result, err := fetch.New(opts).Run(context.Background())
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	if len(store.calls) != 1 {
		t.Fatalf("Upsert called %d times, want 1", len(store.calls))
	}
	if got := store.calls[0][0].ID; got != 100 {
		t.Errorf("stored ID = %d, want 100 (custom Transform ignored)", got)
	}
	if result.Fetched != 5 {
		t.Errorf("Fetched = %d, want 5", result.Fetched)
	}
}

func TestNewToleratesNilLoggerAndSleep(t *testing.T) {
	// New must fill in every optional seam, or a zero-ish Options panics.
	anilist := &stubAniList{}
	store := &stubStore{}

	f := fetch.New(fetch.Options{
		StartID:   1,
		TotalID:   5,
		BatchSize: 5,
		AniList:   anilist,
		Store:     store,
	})

	result, err := f.Run(context.Background())
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	if result.Batches != 1 {
		t.Errorf("Batches = %d, want 1", result.Batches)
	}
}
