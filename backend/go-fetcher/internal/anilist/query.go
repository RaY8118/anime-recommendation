// Package anilist is a small GraphQL client for the public AniList API.
package anilist

// DefaultEndpoint is the public AniList GraphQL endpoint.
const DefaultEndpoint = "https://graphql.anilist.co"

// maxPerPage is the largest page size AniList accepts for media queries.
// Requesting more than this returns an error, so the fetcher validates its
// batch size against this value rather than relying on the server default.
const maxPerPage = 50

// mediaByIDsQuery requests a page of anime by AniList ID.
//
// page and perPage are sent explicitly. Omitting them works only because
// AniList happens to default perPage to 50, which silently truncates results
// as soon as a caller asks for a larger batch.
const mediaByIDsQuery = `
query ($id_in: [Int], $page: Int, $perPage: Int) {
	Page(page: $page, perPage: $perPage) {
		pageInfo {
			currentPage
			hasNextPage
			perPage
			total
		}
		media(id_in: $id_in, type: ANIME) {
			id
			title {
				romaji
				english
			}
			description
			genres
			averageScore
			episodes
			duration
			chapters
			volumes
			season
			seasonYear
			status
			source
			studios {
				nodes {
					name
				}
			}
			coverImage {
				large
			}
			popularity
		}
	}
}
`
