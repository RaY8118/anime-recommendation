package models

// The types in this file describe the AniList GraphQL wire format. They are
// kept next to the domain types so that the transport and the persistence
// layer agree on the JSON shape, and so the field set requested from AniList
// stays in one place.

// GraphQLRequest is the request envelope sent to the AniList GraphQL endpoint.
type GraphQLRequest struct {
	Query     string         `json:"query"`
	Variables map[string]any `json:"variables"`
}

// GraphQLError is a single entry from the GraphQL "errors" array.
//
// AniList answers a malformed or rejected request with HTTP 200 and an empty
// data object, so the errors array is the only reliable failure signal for
// those cases.
type GraphQLError struct {
	Message string `json:"message"`
	Status  int    `json:"status"`
}

// Error renders a GraphQLError as a Go error string.
func (e GraphQLError) Error() string {
	return e.Message
}

// GraphQLResponse is the response envelope returned by AniList.
type GraphQLResponse struct {
	Data   GraphQLData    `json:"data"`
	Errors []GraphQLError `json:"errors"`
}

// GraphQLData is the top level "data" object of the response.
type GraphQLData struct {
	Page GraphQLPage `json:"Page"`
}

// GraphQLPage is a page of results plus its pagination metadata.
type GraphQLPage struct {
	PageInfo PageInfo       `json:"pageInfo"`
	Media    []GraphQLMedia `json:"media"`
}

// PageInfo reports pagination state for a page of results.
type PageInfo struct {
	CurrentPage int  `json:"currentPage"`
	HasNextPage bool `json:"hasNextPage"`
	PerPage     int  `json:"perPage"`
	Total       int  `json:"total"`
}

// GraphQLMedia is a media entry exactly as AniList returns it. Studios arrive
// as a connection object and are flattened to []string during transformation.
type GraphQLMedia struct {
	ID           int              `json:"id"`
	Title        Title            `json:"title"`
	Description  *string          `json:"description"`
	Genres       []string         `json:"genres"`
	AverageScore *int             `json:"averageScore"`
	Episodes     *int             `json:"episodes"`
	Duration     *int             `json:"duration"`
	Chapters     *int             `json:"chapters"`
	Volumes      *int             `json:"volumes"`
	Season       *string          `json:"season"`
	SeasonYear   *int             `json:"seasonYear"`
	Status       *string          `json:"status"`
	Source       *string          `json:"source"`
	Studios      StudioConnection `json:"studios"`
	CoverImage   *CoverImage      `json:"coverImage"`
	Popularity   int              `json:"popularity"`
}

// StudioConnection is the list wrapper AniList uses for studios.
type StudioConnection struct {
	Nodes []Studio `json:"nodes"`
}

// Studio is a single animation studio.
type Studio struct {
	Name string `json:"name"`
}
