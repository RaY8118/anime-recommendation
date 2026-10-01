// Package models holds the domain types persisted in MongoDB.
//
// The BSON field names below are a cross-service contract. The Python FastAPI
// backend (app/schemas/animes.py, app/routers/animes.py) projects and filters
// these documents with camelCase keys such as "averageScore" and "seasonYear",
// and the React frontend reads the same names over HTTP.
//
// Every field therefore carries an explicit bson tag. The mongo driver's
// implicit default is the lower-cased Go field name, which silently persists
// "averagescore" and "seasonyear" instead, breaking the top-rated sort, the
// score/year filters and the score display in the UI.
//
// Nullable AniList fields use pointers so that an absent value is stored as
// BSON null rather than as a zero value. This matches the Optional[...] fields
// written by the Python ingest path (app/utils/anime_api.py).
package models

// Media is a single anime document as stored in the anime collection.
type Media struct {
	ID           int         `json:"id" bson:"id"`
	Title        Title       `json:"title" bson:"title"`
	Description  *string     `json:"description" bson:"description"`
	Genres       []string    `json:"genres" bson:"genres"`
	AverageScore *int        `json:"averageScore" bson:"averageScore"`
	Episodes     *int        `json:"episodes" bson:"episodes"`
	Duration     *int        `json:"duration" bson:"duration"`
	Chapters     *int        `json:"chapters" bson:"chapters"`
	Volumes      *int        `json:"volumes" bson:"volumes"`
	Season       *string     `json:"season" bson:"season"`
	SeasonYear   *int        `json:"seasonYear" bson:"seasonYear"`
	Status       *string     `json:"status" bson:"status"`
	Source       *string     `json:"source" bson:"source"`
	Studios      []string    `json:"studios" bson:"studios"`
	CoverImage   *CoverImage `json:"coverImage" bson:"coverImage"`
	Popularity   int         `json:"popularity" bson:"popularity"`
}

// Title holds both the normalised and the display form of an anime title.
//
// Romaji and English are lower-cased because the API resolves titles with
// case-insensitive regex matches against those fields
// (app/routers/animes.py: {"title.romaji": {"$regex": ...}}). The display_*
// fields keep the original casing for presentation.
type Title struct {
	Romaji         *string `json:"romaji" bson:"romaji"`
	English        *string `json:"english" bson:"english"`
	DisplayRomaji  *string `json:"display_romaji" bson:"display_romaji"`
	DisplayEnglish *string `json:"display_english" bson:"display_english"`
}

// CoverImage holds the artwork URLs for a media entry.
type CoverImage struct {
	Large *string `json:"large" bson:"large"`
}
