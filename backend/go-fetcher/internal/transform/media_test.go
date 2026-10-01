package transform

import (
	"testing"

	"github.com/RaY8118/anime-recommendation/backend/go-fetcher/internal/models"
)

func stringp(s string) *string { return &s }
func intp(i int) *int          { return &i }

func TestCleanHTML(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"Hello", "Hello"},
		{"<br>", ""},
		{"<br/>", ""},
		{"<br />", ""},
		{"Line1<br>Line2", "Line1 Line2"},
		{"Line1<br/>Line2", "Line1 Line2"},
		{"<p>Hi</p>", "Hi"},
		{"  <b>Bold</b> and <i>italic</i>  ", "Bold and italic"},
		{"It&#039;s fine &amp; good", "It&#039;s fine &amp; good"},
	}
	for _, c := range cases {
		if got := CleanHTML(c.in); got != c.want {
			t.Errorf("CleanHTML(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestMediaPreservesFieldNamesAndNulls(t *testing.T) {
	in := models.GraphQLMedia{
		ID:           12345,
		Title:        models.Title{Romaji: stringp("Attack on Titan"), English: stringp("Attack on Titan")},
		Description:  stringp("<p>Humanity fights.<br/>Survive.</p>"),
		Genres:       []string{"Action", "Drama"},
		AverageScore: intp(90),
		Episodes:     intp(25),
		Duration:     intp(24),
		Chapters:     intp(0),
		Volumes:      intp(0),
		Season:       stringp("SPRING"),
		SeasonYear:   intp(2013),
		Status:       stringp("FINISHED"),
		Source:       stringp("MANGA"),
		Studios:      models.StudioConnection{Nodes: []models.Studio{{Name: "Wit Studio"}, {Name: "Production I.G"}}},
		CoverImage:   &models.CoverImage{Large: stringp("https://example.com/cover.jpg")},
		Popularity:   1000,
	}

	got := Media(in)

	// Cleaned description
	if got.Description == nil || *got.Description != "Humanity fights. Survive." {
		t.Fatalf("description mismatch: %#v", got.Description)
	}

	// Titles: display preserve original casing; searchable lowercased
	if got.Title.DisplayRomaji == nil || *got.Title.DisplayRomaji != "Attack on Titan" {
		t.Errorf("DisplayRomaji wrong: %#v", got.Title.DisplayRomaji)
	}
	if got.Title.DisplayEnglish == nil || *got.Title.DisplayEnglish != "Attack on Titan" {
		t.Errorf("DisplayEnglish wrong: %#v", got.Title.DisplayEnglish)
	}
	if got.Title.Romaji == nil || *got.Title.Romaji != "attack on titan" {
		t.Errorf("Romaji lowercased wrong: %#v", got.Title.Romaji)
	}
	if got.Title.English == nil || *got.Title.English != "attack on titan" {
		t.Errorf("English lowercased wrong: %#v", got.Title.English)
	}

	// Scalars preserved
	if got.ID != 12345 || got.AverageScore == nil || *got.AverageScore != 90 || got.SeasonYear == nil || *got.SeasonYear != 2013 {
		t.Errorf("scalars wrong: id=%d avg=%#v year=%#v", got.ID, got.AverageScore, got.SeasonYear)
	}

	// Studios flattened
	if len(got.Studios) != 2 || got.Studios[0] != "Wit Studio" || got.Studios[1] != "Production I.G" {
		t.Errorf("studios wrong: %#v", got.Studios)
	}

	// CoverImage forwarded
	if got.CoverImage == nil || got.CoverImage.Large == nil {
		t.Errorf("coverImage lost: %#v", got.CoverImage)
	}
}

func TestMediaHandlesAbsentValues(t *testing.T) {
	in := models.GraphQLMedia{
		ID:      1,
		Title:   models.Title{},
		Studios: models.StudioConnection{},
		Genres:  nil,
	}
	got := Media(in)

	if got.Description != nil {
		t.Errorf("description should be nil, got %#v", got.Description)
	}
	if got.Title.Romaji != nil || got.Title.English != nil || got.Title.DisplayRomaji != nil || got.Title.DisplayEnglish != nil {
		t.Errorf("titles should be nil when absent: %#v", got.Title)
	}
	if got.Genres == nil || len(got.Genres) != 0 {
		t.Errorf("genres should be empty slice, got %#v", got.Genres)
	}
	if got.Studios == nil || len(got.Studios) != 0 {
		t.Errorf("studios should be empty slice, got %#v", got.Studios)
	}
}
