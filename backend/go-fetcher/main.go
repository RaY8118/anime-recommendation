package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"go-fetcher/internal/database"

	"github.com/joho/godotenv"
)

type GraphQLMedia struct {
	ID           int              `json:"id"`
	Title        Title            `json:"title"`
	Description  string           `json:"description"`
	Genres       []string         `json:"genres"`
	AverageScore int              `json:"averageScore"`
	Episodes     int              `json:"episodes"`
	Duration     int              `json:"duration"`
	Chapters     int              `json:"chapters"`
	Volumes      int              `json:"volumes"`
	Season       string           `json:"season"`
	SeasonYear   int              `json:"seasonYear"`
	Status       string           `json:"status"`
	Source       string           `json:"source"`
	Studios      StudioConnection `json:"studios"`
	CoverImage   CoverImage       `json:"coverImage" bson:"coverImage"`
	Popularity   int              `json:"popularity"`
}

type Media struct {
	ID           int        `json:"id"`
	Title        Title      `json:"title"`
	Description  string     `json:"description"`
	Genres       []string   `json:"genres"`
	AverageScore int        `json:"averageScore"`
	Episodes     int        `json:"episodes"`
	Duration     int        `json:"duration"`
	Chapters     int        `json:"chapters"`
	Volumes      int        `json:"volumes"`
	Season       string     `json:"season"`
	SeasonYear   int        `json:"seasonYear"`
	Status       string     `json:"status"`
	Source       string     `json:"source"`
	Studios      []string   `json:"studios"`
	CoverImage   CoverImage `json:"coverImage" bson:"coverImage"`
	Popularity   int        `json:"popularity"`
}
type Title struct {
	Romaji         string `json:"romaji"`
	English        string `json:"english"`
	DisplayRomaji  string `json:"display_romaji" bson:"display_romaji"`
	DisplayEnglish string `json:"display_english" bson:"display_english"`
}

type CoverImage struct {
	Large string `json:"large"`
}

type StudioConnection struct {
	Nodes []Studio `json:"nodes"`
}

type Studio struct {
	Name string `json:"name"`
}

type PageInfo struct {
	CurrentPage int  `json:"currentPage"`
	HasNextPage bool `json:"hasNextPage"`
	PerPage     int  `json:"perPage"`
}

type GraphQLRequest struct {
	Query     string                 `json:"query"`
	Variables map[string]interface{} `json:"variables"`
}

type GraphQLResponse struct {
	Data struct {
		Page struct {
			PageInfo PageInfo       `json:"pageInfo"`
			Media    []GraphQLMedia `json:"media"`
		} `json:"page"`
	} `json:"data"`
}

func fetch_data(ids []int) ([]Media, error) {
	query := `
		query ($id: Int, $page: Int, $perPage: Int, $search: String, $id_in: [Int]) {
			Page (page: $page, perPage: $perPage) {
				pageInfo {
					currentPage
					hasNextPage
					perPage
				}
				media (id: $id, search: $search, id_in: $id_in, type: ANIME) {
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

	requestBody := GraphQLRequest{Query: query, Variables: map[string]interface{}{
		"id_in": ids,
	}}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		panic(err)
	}

	resp, err := http.Post("https://graphql.anilist.co", "application/json", bytes.NewBuffer(jsonData))

	if err != nil {
		panic(err)
	}

	defer resp.Body.Close()

	var result GraphQLResponse

	err = json.NewDecoder(resp.Body).Decode(&result)

	if err != nil {
		return nil, err
	}

	return processMedia(result.Data.Page.Media), nil

}

func main() {
	err := godotenv.Load("../.env")
	if err != nil {
		fmt.Println("Error loading .env file:", err)
	}

	client := database.InitMongoDB()
	defer client.Disconnect(context.TODO())

	coll := client.Database("anime_recommendation").Collection("new_animes")

	var allMedia []Media

	for start := 1; start <= 200; start += 50 {
		ids := make([]int, 50)

		for i := range ids {
			ids[i] = start + i
		}

		fmt.Println("Fetching:", ids[0], "to", ids[len(ids)-1])

		media, err := fetch_data(ids)
		if err != nil {
			fmt.Println("Error", err)
			continue
		}

		allMedia = append(allMedia, media...)

		fmt.Println("Received", len(media), "anime")

		if start+50 <= 200 {
			time.Sleep(3 * time.Second)
		}
	}

	result, err := coll.InsertMany(context.TODO(), allMedia)
	if err != nil {
		panic(err)
	}
	fmt.Println("Saved", len(result.InsertedIDs), "anime")
}

func worker(id int, jobs <-chan []int, wg *sync.WaitGroup, ticker *time.Ticker) {
	defer wg.Done()

	for ids := range jobs {
		<-ticker.C

		fmt.Println("Worker", id, "got", ids)

		fetch_data(ids)
	}
}

func processMedia(media []GraphQLMedia) []Media {
	result := make([]Media, 0, len(media))

	for _, m := range media {
		studios := make([]string, 0, len(m.Studios.Nodes))

		for _, studio := range m.Studios.Nodes {
			studios = append(studios, studio.Name)
		}

		m.Title.DisplayRomaji = m.Title.Romaji
		m.Title.DisplayEnglish = m.Title.English

		m.Title.Romaji = strings.ToLower(m.Title.Romaji)
		m.Title.English = strings.ToLower(m.Title.English)

		result = append(result, Media{
			ID:           m.ID,
			Title:        m.Title,
			Description:  m.Description,
			Genres:       m.Genres,
			AverageScore: m.AverageScore,
			Episodes:     m.Episodes,
			Duration:     m.Duration,
			Chapters:     m.Chapters,
			Volumes:      m.Volumes,
			Season:       m.Season,
			SeasonYear:   m.SeasonYear,
			Status:       m.Status,
			Source:       m.Source,
			Studios:      studios,
			CoverImage:   m.CoverImage,
			Popularity:   m.Popularity,
		})
	}

	return result
}
