package ingest

import (
	"github.com/RaY8118/anime-recommendation/backend/go-fetcher/gen/anime/v1" // package animev1

	"github.com/RaY8118/anime-recommendation/backend/go-fetcher/internal/models"

	"google.golang.org/protobuf/proto"
)

// Media converts a domain document into a proto ingest request.
func Media(m models.Media) *animev1.IngestAnimeRequest {
	return &animev1.IngestAnimeRequest{
		Id:           int32(m.ID),
		Title:        Title(m.Title),
		Description:  StrPtr(m.Description),
		Genres:       m.Genres,
		AverageScore: Int32Ptr(m.AverageScore),
		Episodes:     Int32Ptr(m.Episodes),
		Duration:     Int32Ptr(m.Duration),
		Chapters:     Int32Ptr(m.Chapters),
		Volumes:      Int32Ptr(m.Volumes),
		Season:       StrPtr(m.Season),
		SeasonYear:   Int32Ptr(m.SeasonYear),
		Status:       StrPtr(m.Status),
		Source:       StrPtr(m.Source),
		Studios:      m.Studios,
		CoverImage:   CoverImage(m.CoverImage),
		IsAdult:      BoolPtr(m.IsAdult),
		Popularity:   int32(m.Popularity),
	}
}

// Title keeps the computed normalization (lowercased romaji/english,
// original casing in display fields) as-is — transform already did the work;
// the Python mapping applies the identical rules idempotently.
func Title(t models.Title) *animev1.Title {
	return &animev1.Title{
		TitleRomaji:    StrPtr(t.Romaji),
		TitleEnglish:   StrPtr(t.English),
		DisplayRomaji:  StrPtr(t.DisplayRomaji),
		DisplayEnglish: StrPtr(t.DisplayEnglish),
	}
}

func CoverImage(c *models.CoverImage) *animev1.CoverImage {
	if c == nil {
		return nil
	}
	return &animev1.CoverImage{Large: StrPtr(c.Large)}
}

// StrPtr/Int32Ptr: nil pointer → nil (unset), non-nil → proto presence set.
// proto.String/proto.Int32 allocate; helpers keep call sites small.
func StrPtr(s *string) *string {
	if s == nil {
		return nil
	}
	return proto.String(*s)
}

func Int32Ptr(p *int) *int32 {
	if p == nil {
		return nil
	}
	return proto.Int32(int32(*p))
}

func BoolPtr(b bool) *bool {
	return proto.Bool(b)
}
