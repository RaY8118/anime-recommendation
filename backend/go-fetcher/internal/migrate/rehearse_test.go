//go:build integration

// Command rehearse verifies the migration against a throwaway copy of the real
// collection. It never touches anime_recommendation.
//
//	go test -tags integration ./internal/migrate/ -run TestRehearse -v
package migrate_test

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/RaY8118/anime-recommendation/backend/go-fetcher/internal/migrate"
	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const (
	sourceDB      = "anime_recommendation"
	sourceColl    = "new_animes"
	rehearsalDB   = "scratch_rehearsal"
	rehearsalColl = "new_animes"
)

func connect(t *testing.T) *mongo.Client {
	t.Helper()

	_ = godotenv.Load("../../../.env")
	uri := os.Getenv("MONGODB_URI")
	if uri == "" {
		t.Skip("MONGODB_URI not set")
	}

	client, err := mongo.Connect(options.Client().ApplyURI(uri).SetServerSelectionTimeout(15 * time.Second))
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	return client
}

// clone copies a capped sample of the real collection into the rehearsal
// database, preserving the legacy field names.
func clone(t *testing.T, client *mongo.Client) (*mongo.Collection, int64) {
	t.Helper()

	ctx := context.Background()
	target := client.Database(rehearsalDB).Collection(rehearsalColl)
	if err := target.Drop(ctx); err != nil {
		t.Fatalf("drop rehearsal: %v", err)
	}

	source := client.Database(sourceDB).Collection(sourceColl)
	cursor, err := source.Find(ctx, bson.D{}, options.Find().SetLimit(500))
	if err != nil {
		t.Fatalf("find source: %v", err)
	}
	defer cursor.Close(ctx)

	var copied int64
	models := make([]any, 0, 500)
	for cursor.Next(ctx) {
		var doc bson.M
		if err := cursor.Decode(&doc); err != nil {
			t.Fatalf("decode: %v", err)
		}
		// Drop the source _id so the copy gets its own.
		delete(doc, "_id")
		models = append(models, doc)
		copied++
	}
	if err := cursor.Err(); err != nil {
		t.Fatalf("cursor: %v", err)
	}
	if copied == 0 {
		t.Skip("no source documents")
	}

	if _, err := target.InsertMany(ctx, models); err != nil {
		t.Fatalf("insert rehearsal docs: %v", err)
	}

	return target, copied
}

func countKeys(t *testing.T, coll *mongo.Collection) (map[string]int64, int64) {
	t.Helper()

	ctx := context.Background()
	total, err := coll.CountDocuments(ctx, bson.D{})
	if err != nil {
		t.Fatalf("count: %v", err)
	}

	keys := map[string]int64{
		"averagescore": 0,
		"averageScore": 0,
		"seasonyear":   0,
		"seasonYear":   0,
	}
	for key := range keys {
		n, err := coll.CountDocuments(ctx, bson.M{key: bson.M{"$exists": true}})
		if err != nil {
			t.Fatalf("count %s: %v", key, err)
		}
		keys[key] = n
	}

	return keys, total
}

func TestRehearse(t *testing.T) {
	client := connect(t)
	defer client.Disconnect(context.Background())

	coll, copied := clone(t, client)
	defer func() {
		_ = client.Database(rehearsalDB).Drop(context.Background())
	}()

	ctx := context.Background()

	before, total := countKeys(t, coll)
	t.Logf("cloned %d documents", copied)
	t.Logf("before: total=%d %v", total, before)

	if before["averagescore"] == 0 {
		t.Skip("source collection has no legacy fields; migration already applied")
	}

	renamer := migrate.NewRenamer(coll)
	plan, err := renamer.Inspect(ctx)
	if err != nil {
		t.Fatalf("inspect: %v", err)
	}
	t.Logf("plan: total=%d %v", plan.Total, plan.Renamed)

	renamed, err := renamer.Run(ctx)
	if err != nil {
		t.Fatalf("rename: %v", err)
	}
	t.Logf("renamed: %v", renamed)

	after, totalAfter := countKeys(t, coll)
	t.Logf("after:  total=%d %v", totalAfter, after)

	if after["averagescore"] != 0 {
		t.Errorf("legacy averagescore still present on %d documents", after["averagescore"])
	}
	if after["seasonyear"] != 0 {
		t.Errorf("legacy seasonyear still present on %d documents", after["seasonyear"])
	}
	if after["averageScore"] != before["averagescore"] {
		t.Errorf("averageScore count %d != legacy count %d", after["averageScore"], before["averagescore"])
	}
	if after["seasonYear"] != before["seasonyear"] {
		t.Errorf("seasonYear count %d != legacy count %d", after["seasonYear"], before["seasonyear"])
	}
	if totalAfter != total {
		t.Errorf("document count changed: %d -> %d", total, totalAfter)
	}

	// Idempotency: a second run must be a no-op.
	renamedAgain, err := renamer.Run(ctx)
	if err != nil {
		t.Fatalf("second rename: %v", err)
	}
	t.Logf("second run renamed: %v", renamedAgain)
	for key, count := range renamedAgain {
		if count != 0 {
			t.Errorf("second run modified %d docs for %s, expected 0", count, key)
		}
	}

	// Values must survive the rewrite.
	var sample bson.M
	if err := coll.FindOne(ctx, bson.M{"averageScore": bson.M{"$exists": true}}).Decode(&sample); err == nil {
		t.Logf("sample after migration: id=%v averageScore=%v (%T) seasonYear=%v title=%v",
			sample["id"], sample["averageScore"], sample["averageScore"], sample["seasonYear"], sample["title"])
		if sample["title"] == nil {
			t.Error("title field was lost during rewrite")
		}
		if sample["genres"] == nil && sample["studios"] == nil {
			t.Error("genres and studios both lost during rewrite")
		}
	}

	// HTML cleanup
	matches, err := migrate.NewHTMLCleaner(coll).Matches(ctx)
	if err != nil {
		t.Fatalf("html matches: %v", err)
	}
	t.Logf("descriptions with HTML before clean: %d", matches)

	if matches > 0 {
		cleaned, err := migrate.NewHTMLCleaner(coll).Run(ctx)
		if err != nil {
			t.Fatalf("html clean: %v", err)
		}
		t.Logf("descriptions cleaned: %d", cleaned)

		remaining, err := migrate.NewHTMLCleaner(coll).Matches(ctx)
		if err != nil {
			t.Fatalf("html recheck: %v", err)
		}
		if remaining != 0 {
			t.Errorf("%d descriptions still contain HTML", remaining)
		}

		var htmlDoc bson.M
		if err := coll.FindOne(ctx, bson.M{"description": bson.M{"$exists": true}}).Decode(&htmlDoc); err == nil {
			desc, _ := htmlDoc["description"].(string)
			t.Logf("sample description: %.140q", desc)
		}
	}

	fmt.Println("rehearsal database dropped")
}
