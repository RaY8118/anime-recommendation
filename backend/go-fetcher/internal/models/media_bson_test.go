package models

import (
	"testing"

	"go.mongodb.org/mongo-driver/v2/bson"
)

func stringp(s string) *string { return &s }
func intp(i int) *int          { return &i }

func TestBSONTagsMatchPythonContract(t *testing.T) {
	// A document with the fields the Python backend reads.
	m := Media{
		ID:           1,
		Title:        Title{Romaji: stringp("naruto"), English: nil, DisplayRomaji: stringp("Naruto"), DisplayEnglish: nil},
		Description:  stringp("Shounen"),
		Genres:       []string{"Action"},
		AverageScore: intp(80),
		Episodes:     intp(220),
		Duration:     intp(23),
		Chapters:     intp(0),
		Volumes:      intp(0),
		Season:       stringp("WINTER"),
		SeasonYear:   intp(2002),
		Status:       stringp("FINISHED"),
		Source:       stringp("MANGA"),
		Studios:      []string{"Pierrot"},
		CoverImage:   &CoverImage{Large: stringp("https://example.com/naruto.jpg")},
		Popularity:   5000,
	}

	b, err := bson.Marshal(m)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var out bson.M
	if err := bson.Unmarshal(b, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	expected := map[string]struct{}{
		"id":           {},
		"title":        {},
		"description":  {},
		"genres":       {},
		"averageScore": {},
		"episodes":     {},
		"duration":     {},
		"chapters":     {},
		"volumes":      {},
		"season":       {},
		"seasonYear":   {},
		"status":       {},
		"source":       {},
		"studios":      {},
		"coverImage":   {},
		"popularity":   {},
	}

	for k := range out {
		if _, ok := expected[k]; !ok {
			t.Errorf("unexpected BSON key %q", k)
		}
		delete(expected, k)
	}
	for k := range expected {
		t.Errorf("missing BSON key %q", k)
	}
}
