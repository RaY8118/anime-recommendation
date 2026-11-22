// Package models holds the domain types persisted via the gRPC ingest
// (internal/ingest) into MongoDB by the Python backend.
//
// Field semantics cross the wire twice: Go pointer → proto optional presence
// (enforced by mapping_test.go) → Mongo null vs value (enforced by the
// Python Anime schema). Those two compiled/validated contracts replace the
// old hand-synced BSON tags; neither side may gain a persisted field without
// updating the proto and running buf breaking+generate.
package models

// Media is a single anime document as stored in the new_animes collection.
// Nullable AniList fields use pointers so an absent value maps to proto unset
// (`HasField` false) and then to BSON null rather than a zero value.
type Media struct {
	ID           int         `json:"id"`
	Title        Title       `json:"title"`
	Description  *string     `json:"description"`
	Genres       []string    `json:"genres"`
	AverageScore *int        `json:"averageScore"`
	Episodes     *int        `json:"episodes"`
	Duration     *int        `json:"duration"`
	Chapters     *int        `json:"chapters"`
	Volumes      *int        `json:"volumes"`
	Season       *string     `json:"season"`
	SeasonYear   *int        `json:"seasonYear"`
	Status       *string     `json:"status"`
	Source       *string     `json:"source"`
	Studios      []string    `json:"studios"`
	CoverImage   *CoverImage `json:"coverImage"`
	Popularity   int         `json:"popularity"`
	IsAdult      bool        `json:"isAdult"`
}

// Title holds both the normalised and the display form of an anime title.
// (doc comment unchanged from current)
type Title struct {
	Romaji         *string `json:"romaji"`
	English        *string `json:"english"`
	DisplayRomaji  *string `json:"display_romaji"`
	DisplayEnglish *string `json:"display_english"`
}

// CoverImage holds the artwork URLs for a media entry.
type CoverImage struct {
	Large *string `json:"large"`
}
