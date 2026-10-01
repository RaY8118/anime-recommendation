// Package transform converts AniList wire types into the domain documents
// persisted in MongoDB.
package transform

import (
	"regexp"
	"strings"

	"github.com/RaY8118/anime-recommendation/backend/go-fetcher/internal/models"
)

var (
	// brTag matches line breaks, which become spaces.
	brTag = regexp.MustCompile(`<br\s*/?>`)

	// anyTag matches any remaining HTML tag.
	anyTag = regexp.MustCompile(`<.*?>`)
)

// CleanHTML strips HTML markup from text.
//
// This mirrors clean_html in backend/app/utils/clean_text.py exactly, including
// leaving HTML entities such as &quot; and &mdash; untouched, so that Go and
// Python produce identical descriptions for the same input.
func CleanHTML(text string) string {
	text = brTag.ReplaceAllString(text, " ")
	text = anyTag.ReplaceAllString(text, "")
	return strings.TrimSpace(text)
}

// Media converts a single AniList entry into a domain document.
func Media(in models.GraphQLMedia) models.Media {
	studios := make([]string, 0, len(in.Studios.Nodes))
	for _, studio := range in.Studios.Nodes {
		studios = append(studios, studio.Name)
	}

	genres := in.Genres
	if genres == nil {
		genres = []string{}
	}

	out := models.Media{
		ID:         in.ID,
		Title:      title(in.Title),
		Genres:     genres,
		Studios:    studios,
		Popularity: in.Popularity,
	}

	if in.Description != nil {
		description := CleanHTML(*in.Description)
		out.Description = &description
	}
	out.AverageScore = in.AverageScore
	out.Episodes = in.Episodes
	out.Duration = in.Duration
	out.Chapters = in.Chapters
	out.Volumes = in.Volumes
	out.Season = in.Season
	out.SeasonYear = in.SeasonYear
	out.Status = in.Status
	out.Source = in.Source
	out.CoverImage = in.CoverImage

	return out
}

// MediaList converts a page of AniList entries into domain documents.
func MediaList(in []models.GraphQLMedia) []models.Media {
	out := make([]models.Media, 0, len(in))
	for _, entry := range in {
		out = append(out, Media(entry))
	}
	return out
}

// title lower-cases the searchable title fields while preserving the original
// casing in the display fields. An absent title is stored as null rather than
// as an empty string, matching the Python ingest path.
func title(in models.Title) models.Title {
	return models.Title{
		Romaji:         lower(in.Romaji),
		English:        lower(in.English),
		DisplayRomaji:  copy(in.Romaji),
		DisplayEnglish: copy(in.English),
	}
}

// lower normalises a title for case-insensitive matching, mapping an absent
// value to null.
func lower(s *string) *string {
	if s == nil || *s == "" {
		return nil
	}

	lowered := strings.ToLower(*s)
	return &lowered
}

// copy returns an independent copy of an optional string.
func copy(s *string) *string {
	if s == nil {
		return nil
	}

	value := *s
	return &value
}
