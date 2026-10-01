// Package database owns the MongoDB connection and the anime collection.
package database

import (
	"context"
	"fmt"
	"time"

	"github.com/RaY8118/anime-recommendation/backend/go-fetcher/internal/models"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// Connect dials MongoDB and verifies the deployment is reachable before
// returning. Every failure is reported as an error rather than terminating the
// process, so the caller decides how to handle it.
func Connect(ctx context.Context, uri string, timeout time.Duration) (*mongo.Client, error) {
	if uri == "" {
		return nil, fmt.Errorf("database: empty MongoDB URI")
	}

	connectCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	client, err := mongo.Connect(options.Client().
		ApplyURI(uri).
		SetServerSelectionTimeout(timeout).
		SetServerAPIOptions(options.ServerAPI(options.ServerAPIVersion1)))
	if err != nil {
		return nil, fmt.Errorf("database: connect: %w", err)
	}

	if err := ping(connectCtx, client); err != nil {
		// Release the resources of a client that never became usable.
		_ = client.Disconnect(context.WithoutCancel(ctx))
		return nil, err
	}

	return client, nil
}

// ping checks that the deployment responds.
func ping(ctx context.Context, client *mongo.Client) error {
	var result bson.M
	if err := client.Database("admin").RunCommand(ctx, bson.D{{Key: "ping", Value: 1}}).Decode(&result); err != nil {
		return fmt.Errorf("database: ping: %w", err)
	}
	return nil
}

// Store persists anime documents.
type Store struct {
	collection *mongo.Collection
}

// NewStore binds a Store to a collection.
func NewStore(client *mongo.Client, database, collection string) *Store {
	return &Store{collection: client.Database(database).Collection(collection)}
}

// Collection exposes the underlying collection for callers that need direct
// access.
func (s *Store) Collection() *mongo.Collection {
	return s.collection
}

// WriteResult reports what an Upsert call did.
type WriteResult struct {
	Upserted int64
	Matched  int64
	Modified int64
}

// Upsert stores the given documents, keyed on the anime ID.
//
// Using a replace-upsert makes re-running the fetcher idempotent: a document
// that already exists is refreshed in place instead of being duplicated. The
// write is unordered so that one rejected document does not abort the batch.
func (s *Store) Upsert(ctx context.Context, media []models.Media) (WriteResult, error) {
	if len(media) == 0 {
		return WriteResult{}, nil
	}

	writes := make([]mongo.WriteModel, 0, len(media))
	for _, item := range media {
		writes = append(writes, mongo.NewReplaceOneModel().
			SetFilter(bson.D{{Key: "id", Value: item.ID}}).
			SetReplacement(item).
			SetUpsert(true))
	}

	result, err := s.collection.BulkWrite(ctx, writes, options.BulkWrite().SetOrdered(false))
	if err != nil {
		return WriteResult{}, fmt.Errorf("database: write %d documents: %w", len(media), err)
	}

	return WriteResult{
		Upserted: result.UpsertedCount,
		Matched:  result.MatchedCount,
		Modified: result.ModifiedCount,
	}, nil
}
