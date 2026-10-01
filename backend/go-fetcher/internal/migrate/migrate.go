// Package migrate repairs documents written by the original go-fetcher, which
// persisted the Go field name lower-cased instead of the camelCase BSON name
// the Python API reads.
//
// The legacy documents carry "averagescore" and "seasonyear" instead of
// "averageScore" and "seasonYear". Because every read in the backend is written
// against the camelCase names, those fields appear absent: the top-rated sort
// orders on a missing key, the score and year filters match nothing, and the
// frontend renders "N/A" for every score.
//
// The repair is a $rename, which is atomic per document and does not rewrite
// the row. The field is moved rather than copied so that the stale key cannot
// resurface.
package migrate

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/RaY8118/anime-recommendation/backend/go-fetcher/internal/transform"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// LegacyFields are the field names written by the original fetcher and the
// camelCase names the Python API expects.
type LegacyFields struct {
	From string
	To   string
}

// Renames is the full set of field renames needed to make legacy documents
// readable by the current backend.
var Renames = []LegacyFields{
	{From: "averagescore", To: "averageScore"},
	{From: "seasonyear", To: "seasonYear"},
}

// Renamer repairs field names in a collection.
type Renamer struct {
	collection *mongo.Collection

	// BatchSize is how many documents are read at a time.
	BatchSize int32
}

// NewRenamer binds a Renamer to a collection.
func NewRenamer(collection *mongo.Collection) *Renamer {
	return &Renamer{collection: collection, BatchSize: 200}
}

// MatchCount returns how many documents currently hold the legacy field.
func (r *Renamer) MatchCount(ctx context.Context, from string) (int64, error) {
	filter := bson.M{from: bson.M{"$exists": true}}
	count, err := r.collection.CountDocuments(ctx, filter)
	if err != nil {
		return 0, fmt.Errorf("migrate: count %q: %w", from, err)
	}
	return count, nil
}

// Plan is a dry-run report of the work a migration would perform.
type Plan struct {
	// Renamed counts documents matching each legacy field name.
	Renamed map[string]int64

	// Total is the number of documents in the collection.
	Total int64
}

// Inspect reports what a Run would change, without writing anything.
func (r *Renamer) Inspect(ctx context.Context) (Plan, error) {
	plan := Plan{Renamed: make(map[string]int64, len(Renames))}

	total, err := r.collection.CountDocuments(ctx, bson.D{})
	if err != nil {
		return Plan{}, fmt.Errorf("migrate: count documents: %w", err)
	}
	plan.Total = total

	for _, rename := range Renames {
		count, err := r.MatchCount(ctx, rename.From)
		if err != nil {
			return Plan{}, err
		}
		plan.Renamed[rename.From] = count
	}

	return plan, nil
}

// Run renames the legacy fields to the camelCase names the API reads.
//
// Each document is read, its keys moved in memory, and the result written back
// with ReplaceOne. A full rewrite is used rather than $rename because $rename
// is a silent no-op on Atlas free tier: the server reports the document as
// matched but modified=0 and the field is left untouched, which would make the
// migration look successful while changing nothing.
//
// Documents that already carry the correct field are left alone, so Run is safe
// to call repeatedly.
func (r *Renamer) Run(ctx context.Context) (map[string]int64, error) {
	results := make(map[string]int64, len(Renames))
	for _, rename := range Renames {
		results[rename.From] = 0
	}

	cursor, err := r.collection.Find(ctx, bson.D{}, options.Find().SetBatchSize(r.BatchSize))
	if err != nil {
		return nil, fmt.Errorf("migrate: scan documents: %w", err)
	}
	defer cursor.Close(ctx)

	for cursor.Next(ctx) {
		var doc bson.M
		if err := cursor.Decode(&doc); err != nil {
			return nil, fmt.Errorf("migrate: decode document: %w", err)
		}

		changed := false
		for _, rename := range Renames {
			value, legacy := doc[rename.From]
			if !legacy {
				continue
			}
			// Never clobber a field that already holds the correct name.
			if _, exists := doc[rename.To]; exists {
				delete(doc, rename.From)
				changed = true
				continue
			}
			doc[rename.To] = value
			delete(doc, rename.From)
			changed = true
		}

		if !changed {
			continue
		}

		id, hasID := doc["_id"]
		if !hasID {
			return nil, fmt.Errorf("migrate: document without _id")
		}

		if _, err := r.collection.ReplaceOne(ctx, bson.M{"_id": id}, doc); err != nil {
			return nil, fmt.Errorf("migrate: rewrite document %v: %w", id, err)
		}

		for _, rename := range Renames {
			if _, legacy := doc[rename.To]; legacy {
				results[rename.From]++
			}
		}
	}
	if err := cursor.Err(); err != nil {
		return nil, fmt.Errorf("migrate: iterate documents: %w", err)
	}

	return results, nil
}

// Deduplicator removes duplicate anime documents, which the original fetcher
// produced because it appended to the collection on every run without a unique
// index on id.
type Deduplicator struct {
	collection *mongo.Collection
}

// NewDeduplicator binds a Deduplicator to a collection.
func NewDeduplicator(collection *mongo.Collection) *Deduplicator {
	return &Deduplicator{collection: collection}
}

// Duplicate is a group of documents sharing one anime id.
type Duplicate struct {
	AnimeID   int64    `bson:"_id"`
	Count     int64    `bson:"n"`
	Documents []string `bson:"doc_ids"`
}

// InspectDuplicateIDs reports anime ids that have more than one document.
func (d *Deduplicator) InspectDuplicateIDs(ctx context.Context) ([]Duplicate, error) {
	pipeline := mongo.Pipeline{
		{{Key: "$group", Value: bson.D{
			{Key: "_id", Value: "$id"},
			{Key: "n", Value: bson.M{"$sum": 1}},
			{Key: "doc_ids", Value: bson.M{"$push": bson.M{"$toString": "$_id"}}},
		}}},
		{{Key: "$match", Value: bson.D{{Key: "n", Value: bson.M{"$gt": 1}}}}},
		{{Key: "$sort", Value: bson.D{{Key: "_id", Value: 1}}}},
	}

	results := []Duplicate{}
	cur, err := d.collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, fmt.Errorf("migrate: find duplicates: %w", err)
	}
	defer cur.Close(ctx)

	if err := cur.All(ctx, &results); err != nil {
		return nil, fmt.Errorf("migrate: decode duplicates: %w", err)
	}

	return results, nil
}

// ErrDuplicatesRemain signals that the collection still holds duplicate ids, so
// a unique index cannot be created yet.
var ErrDuplicatesRemain = errors.New("migrate: duplicates remain, resolve them before creating a unique index")

// Run keeps the most recently written document for each duplicated anime id and
// deletes the rest, so that exactly one document remains per anime id.
//
// The survivor is the one with the highest _id, which for this fetcher is the
// most recent insertion.
func (d *Deduplicator) Run(ctx context.Context) (deleted int64, err error) {
	duplicates, err := d.InspectDuplicateIDs(ctx)
	if err != nil {
		return 0, err
	}

	for _, group := range duplicates {
		if len(group.Documents) < 2 {
			continue
		}

		keep := group.Documents[len(group.Documents)-1]
		drop := group.Documents[:len(group.Documents)-1]

		result, err := d.collection.DeleteMany(ctx, bson.D{
			{Key: "id", Value: group.AnimeID},
			{Key: "_id", Value: bson.D{{Key: "$in", Value: toObjectIDs(drop)}}},
		})
		if err != nil {
			return deleted, fmt.Errorf("migrate: delete duplicates for anime id %d (keeping %s): %w", group.AnimeID, keep, err)
		}
		deleted += result.DeletedCount
	}

	return deleted, nil
}

// IndexManager creates the indexes the read path depends on.
type IndexManager struct {
	collection *mongo.Collection
}

// NewIndexManager binds an IndexManager to a collection.
func NewIndexManager(collection *mongo.Collection) *IndexManager {
	return &IndexManager{collection: collection}
}

// indexSpec describes an index and why it exists.
type indexSpec struct {
	Name   string
	Keys   bson.D
	Unique bool
	Reason string
}

// indexes are the indexes worth having on the anime collection.
var indexes = []indexSpec{
	{
		Name:   "id_1",
		Keys:   bson.D{{Key: "id", Value: 1}},
		Unique: true,
		Reason: "unique anime id; also makes the fetcher upsert efficient",
	},
	{
		Name:   "averageScore_-1",
		Keys:   bson.D{{Key: "averageScore", Value: -1}},
		Reason: "top-rated sort (animes.py sorts on averageScore desc)",
	},
	{
		Name:   "seasonYear_-1",
		Keys:   bson.D{{Key: "seasonYear", Value: -1}},
		Reason: "season/year filter",
	},
}

// Inspect lists the indexes that already exist.
func (m *IndexManager) Inspect(ctx context.Context) ([]string, error) {
	cur, err := m.collection.Indexes().List(ctx)
	if err != nil {
		return nil, fmt.Errorf("migrate: list indexes: %w", err)
	}
	defer cur.Close(ctx)

	var existing []bson.M
	if err := cur.All(ctx, &existing); err != nil {
		return nil, fmt.Errorf("migrate: decode indexes: %w", err)
	}

	names := make([]string, 0, len(existing))
	for _, index := range existing {
		if name, ok := index["name"].(string); ok {
			names = append(names, name)
		}
	}
	return names, nil
}

// Create adds the missing indexes.
//
// It refuses to create the unique index while duplicate anime ids exist, since
// that would fail partway through and leave the collection indexed
// inconsistently.
func (m *IndexManager) Create(ctx context.Context, allowUnique bool) ([]string, error) {
	if allowUnique {
		duplicates, err := NewDeduplicator(m.collection).InspectDuplicateIDs(ctx)
		if err != nil {
			return nil, err
		}
		if len(duplicates) > 0 {
			return nil, fmt.Errorf("%w: %d anime id(s) are duplicated", ErrDuplicatesRemain, len(duplicates))
		}
	}

	created := []string{}
	for _, spec := range indexes {
		if spec.Unique && !allowUnique {
			continue
		}

		model := mongo.IndexModel{
			Keys:    spec.Keys,
			Options: options.Index().SetName(spec.Name).SetUnique(spec.Unique),
		}

		if _, err := m.collection.Indexes().CreateOne(ctx, model); err != nil {
			// A pre-existing identical index is not a failure.
			if !isIndexExists(err) {
				return created, fmt.Errorf("migrate: create index %q: %w", spec.Name, err)
			}
			continue
		}
		created = append(created, spec.Name)
	}

	return created, nil
}

// IndexPlans describes the indexes that would be created.
func (m *IndexManager) IndexPlans() []indexSpec {
	return indexes
}

// isIndexExists reports whether an error means "this index is already there",
// which is the benign outcome when re-running the migration.
func isIndexExists(err error) bool {
	if err == nil {
		return false
	}

	// 85 IndexOptionsConflict, 86 IndexKeySpecsConflict.
	var serverError mongo.ServerError
	if errors.As(err, &serverError) {
		if serverError.HasErrorCode(85) || serverError.HasErrorCode(86) {
			return true
		}
	}

	return mongo.IsDuplicateKeyError(err)
}

func toObjectIDs(hexIDs []string) []bson.ObjectID {
	ids := make([]bson.ObjectID, 0, len(hexIDs))
	for _, hex := range hexIDs {
		if id, err := bson.ObjectIDFromHex(hex); err == nil {
			ids = append(ids, id)
		}
	}
	return ids
}

// HTMLCleaner strips HTML markup from descriptions, matching the clean_html
// behaviour of the Python ingest path.
//
// Legacy documents were written without this step, so their descriptions carry
// raw <br> and other tags. Those tags flow into the page_content that
// anime_embedding_generation.py embeds, which lowers retrieval quality.
//
// The rewrite is performed in Go rather than with a server-side pipeline
// because $regexReplace is rejected by some deployments; Atlas shared clusters
// answer with "Unrecognized expression". Reusing transform.CleanHTML also
// guarantees the migrated text matches what the fetcher now writes.
type HTMLCleaner struct {
	collection *mongo.Collection

	// BatchSize is how many documents are rewritten per bulk write.
	BatchSize int64
}

// NewHTMLCleaner binds an HTMLCleaner to a collection.
func NewHTMLCleaner(collection *mongo.Collection) *HTMLCleaner {
	return &HTMLCleaner{collection: collection, BatchSize: 200}
}

// htmlFilter matches documents whose description contains markup.
var htmlFilter = bson.M{
	"description": bson.M{
		"$regex": "<br|<p>|</p>|<i>|</i>|<b>|</b>|<span|</span>|<em>|</em>|<strong>",
	},
}

// Matches counts documents whose description contains HTML tags.
func (h *HTMLCleaner) Matches(ctx context.Context) (int64, error) {
	count, err := h.collection.CountDocuments(ctx, htmlFilter)
	if err != nil {
		return 0, fmt.Errorf("migrate: count descriptions with HTML: %w", err)
	}
	return count, nil
}

// htmlDocument is the minimum needed to clean a description.
type htmlDocument struct {
	ID          bson.ObjectID `bson:"_id"`
	Description string        `bson:"description"`
}

// Run rewrites every description that contains HTML, in batches, and returns
// how many documents changed.
//
// Only the description field is written, so a fetcher run updating other fields
// concurrently is not clobbered.
func (h *HTMLCleaner) Run(ctx context.Context) (int64, error) {
	batchSize := h.BatchSize
	if batchSize <= 0 {
		batchSize = 200
	}

	cursor, err := h.collection.Find(ctx, htmlFilter, options.Find().
		SetProjection(bson.D{{Key: "_id", Value: 1}, {Key: "description", Value: 1}}).
		SetBatchSize(int32(batchSize)))
	if err != nil {
		return 0, fmt.Errorf("migrate: find descriptions with HTML: %w", err)
	}
	defer cursor.Close(ctx)

	var (
		modified int64
		pending  []mongo.WriteModel
	)

	flush := func() error {
		if len(pending) == 0 {
			return nil
		}
		if _, err := h.collection.BulkWrite(ctx, pending, options.BulkWrite().SetOrdered(false)); err != nil {
			return fmt.Errorf("migrate: rewrite %d descriptions: %w", len(pending), err)
		}
		pending = pending[:0]
		return nil
	}

	for cursor.Next(ctx) {
		var doc htmlDocument
		if err := cursor.Decode(&doc); err != nil {
			return modified, fmt.Errorf("migrate: decode description document: %w", err)
		}

		cleaned := transform.CleanHTML(doc.Description)
		if cleaned == doc.Description {
			// The filter also matches tags CleanHTML leaves untouched.
			continue
		}

		modified++
		pending = append(pending, mongo.NewUpdateOneModel().
			SetFilter(bson.D{{Key: "_id", Value: doc.ID}}).
			SetUpdate(bson.D{{Key: "$set", Value: bson.D{{Key: "description", Value: cleaned}}}}))

		if int64(len(pending)) >= batchSize {
			if err := flush(); err != nil {
				return modified, err
			}
		}
	}
	if err := cursor.Err(); err != nil {
		return modified, fmt.Errorf("migrate: iterate descriptions: %w", err)
	}
	if err := flush(); err != nil {
		return modified, err
	}

	return modified, nil
}

// Report renders a human-readable summary of a completed migration.
func Report(total int64, renamed map[string]int64, deleted int64, cleaned int64, indexes []string) string {
	out := fmt.Sprintf("documents: %d\n", total)
	for _, rename := range Renames {
		out += fmt.Sprintf("renamed %s -> %s: %d\n", rename.From, rename.To, renamed[rename.From])
	}
	out += fmt.Sprintf("duplicate documents removed: %d\n", deleted)
	out += fmt.Sprintf("descriptions cleaned: %d\n", cleaned)
	out += fmt.Sprintf("indexes created: %v\n", indexes)
	return out
}

// Timeout is the default budget for a single migration step.
const Timeout = 10 * time.Minute

// StepContext derives a context for one migration step.
func StepContext(parent context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(parent, Timeout)
}
