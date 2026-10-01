package anilist

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/RaY8118/anime-recommendation/backend/go-fetcher/internal/models"
)

func TestFetchByIDsSucceeds(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if r.Header.Get("Content-Type") != "application/json" {
			t.Errorf("expected application/json")
		}
		var req models.GraphQLRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode req: %v", err)
		}
		// Verify variables sent
		if v, ok := req.Variables["page"].(float64); !ok || int(v) != 1 {
			t.Errorf("page not sent: %#v", req.Variables["page"])
		}
		if v, ok := req.Variables["perPage"].(float64); !ok || int(v) != 2 {
			t.Errorf("perPage not sent: %#v", req.Variables["perPage"])
		}

		resp := models.GraphQLResponse{}
		resp.Data.Page.Media = []models.GraphQLMedia{{ID: 1}, {ID: 2}}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer srv.Close()

	c := New(Options{Endpoint: srv.URL, Timeout: 5 * time.Second, MaxRetries: 0})
	media, err := c.FetchByIDs(context.Background(), []int{1, 2})
	if err != nil {
		t.Fatalf("FetchByIDs: %v", err)
	}
	if len(media) != 2 {
		t.Fatalf("got %d", len(media))
	}
}

func TestFetchByIDsRejectsLargeBatch(t *testing.T) {
	c := New(Options{MaxRetries: 0})
	ids := make([]int, 51)
	_, err := c.FetchByIDs(context.Background(), ids)
	if err == nil {
		t.Fatal("expected ErrBatchTooLarge")
	}
}

func TestFetchByIDsReturnsGraphQLError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := models.GraphQLResponse{Errors: []models.GraphQLError{{Message: "Invalid variables", Status: 400}}}
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer srv.Close()

	c := New(Options{Endpoint: srv.URL, MaxRetries: 0})
	_, err := c.FetchByIDs(context.Background(), []int{1})
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestFetchByIDsRetriesOn500(t *testing.T) {
	attempts := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		if attempts == 1 {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte("boom"))
			return
		}
		resp := models.GraphQLResponse{}
		resp.Data.Page.Media = []models.GraphQLMedia{{ID: 5}}
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer srv.Close()

	c := New(Options{Endpoint: srv.URL, MaxRetries: 1, RetryBase: time.Nanosecond})
	media, err := c.FetchByIDs(context.Background(), []int{5})
	if err != nil {
		t.Fatalf("FetchByIDs: %v", err)
	}
	if len(media) != 1 || media[0].ID != 5 {
		t.Fatalf("unexpected result")
	}
	if attempts != 2 {
		t.Fatalf("expected 2 attempts, got %d", attempts)
	}
}
