package ingest

import (
	"testing"

	"google.golang.org/protobuf/proto"

	"github.com/RaY8118/anime-recommendation/backend/go-fetcher/gen/anime/v1"

	"github.com/RaY8118/anime-recommendation/backend/go-fetcher/internal/models"
)

// An all-empty domain document must map to presence semantics, not field
// garbage: optional scalars stay unset, the title submessage is always
// present (transform.Media guarantees it), and id/isAdult/popularity are
// non-optional and always carry their values.
func TestZeroMediaFollowsPresenceRules(t *testing.T) {
	req := Media(models.Media{})

	empty := &animev1.IngestAnimeRequest{
		Title:   &animev1.Title{},
		IsAdult: proto.Bool(false),
	}

	if !proto.Equal(req, empty) {
		t.Fatalf("expected all-optional-empty mapping, got %+v vs %+v", req, empty)
	}
}
