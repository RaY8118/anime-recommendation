package anilist

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/RaY8118/anime-recommendation/backend/go-fetcher/internal/models"
)

// Client talks to the AniList GraphQL API.
//
// It owns an http.Client with an explicit timeout, verifies the HTTP status
// before decoding, surfaces the GraphQL "errors" array, and retries transient
// failures with exponential backoff.
type Client struct {
	httpClient *http.Client
	endpoint   string
	maxRetries int
	retryBase  time.Duration
	sleep      func(context.Context, time.Duration) error
}

// Options configures a Client. The zero value of each field is replaced by the
// default applied in New.
type Options struct {
	Endpoint   string
	Timeout    time.Duration
	MaxRetries int
	RetryBase  time.Duration

	// HTTPClient overrides the underlying HTTP client, mainly for tests.
	HTTPClient *http.Client

	// Sleep overrides how the client waits between retries, mainly for tests.
	Sleep func(context.Context, time.Duration) error
}

// New builds a Client. An empty Options value yields a client pointed at the
// public AniList endpoint with a 30s timeout and three retries.
func New(opts Options) *Client {
	timeout := opts.Timeout
	if timeout <= 0 {
		timeout = 30 * time.Second
	}

	maxRetries := opts.MaxRetries
	if maxRetries < 0 {
		maxRetries = 0
	}

	retryBase := opts.RetryBase
	if retryBase <= 0 {
		retryBase = 2 * time.Second
	}

	endpoint := opts.Endpoint
	if endpoint == "" {
		endpoint = DefaultEndpoint
	}

	httpClient := opts.HTTPClient
	if httpClient == nil {
		// A client without a Timeout would block forever on a stalled
		// connection, which is what http.DefaultClient does.
		httpClient = &http.Client{Timeout: timeout}
	}

	sleep := opts.Sleep
	if sleep == nil {
		sleep = sleepCtx
	}

	return &Client{
		httpClient: httpClient,
		endpoint:   endpoint,
		maxRetries: maxRetries,
		retryBase:  retryBase,
		sleep:      sleep,
	}
}

// ErrBatchTooLarge is returned when the caller requests more IDs in one call
// than AniList will return.
var ErrBatchTooLarge = fmt.Errorf("anilist: batch size must not exceed %d", maxPerPage)

// FetchByIDs returns the anime entries matching the given AniList IDs.
//
// IDs that do not exist, or that do not refer to anime, are simply absent from
// the result, so len(result) may be smaller than len(ids). An error is
// returned only when the request itself failed.
func (c *Client) FetchByIDs(ctx context.Context, ids []int) ([]models.GraphQLMedia, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	if len(ids) > maxPerPage {
		return nil, ErrBatchTooLarge
	}

	requestBody, err := json.Marshal(models.GraphQLRequest{
		Query: mediaByIDsQuery,
		Variables: map[string]any{
			"id_in":   ids,
			"page":    1,
			"perPage": len(ids),
		},
	})
	if err != nil {
		return nil, fmt.Errorf("anilist: encode request: %w", err)
	}

	var response models.GraphQLResponse
	if err := c.do(ctx, requestBody, &response); err != nil {
		return nil, err
	}

	return response.Data.Page.Media, nil
}

// do posts the request, retrying transient failures with exponential backoff.
func (c *Client) do(ctx context.Context, body []byte, response *models.GraphQLResponse) error {
	var lastErr error

	for attempt := range c.maxRetries + 1 {
		if attempt > 0 {
			delay := c.retryBase * (1 << (attempt - 1))
			if err := c.sleep(ctx, delay); err != nil {
				return fmt.Errorf("anilist: interrupted while backing off: %w", err)
			}
		}

		retryable, err := c.attempt(ctx, body, response)
		if err == nil {
			return nil
		}
		lastErr = err

		if !retryable {
			return err
		}
	}

	return fmt.Errorf("anilist: giving up after %d attempts: %w", c.maxRetries+1, lastErr)
}

// attempt performs a single request. The bool reports whether the failure is
// worth retrying.
func (c *Client) attempt(ctx context.Context, body []byte, response *models.GraphQLResponse) (bool, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint, bytes.NewReader(body))
	if err != nil {
		return false, fmt.Errorf("anilist: build request: %w", err)
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json")

	httpResponse, err := c.httpClient.Do(request)
	if err != nil {
		return true, fmt.Errorf("anilist: request failed: %w", err)
	}
	defer httpResponse.Body.Close()

	if httpResponse.StatusCode != http.StatusOK {
		return retryableStatus(httpResponse.StatusCode), fmt.Errorf(
			"anilist: unexpected status %d: %s",
			httpResponse.StatusCode, snippet(httpResponse.Body),
		)
	}

	if err := json.NewDecoder(httpResponse.Body).Decode(response); err != nil {
		return false, fmt.Errorf("anilist: decode response: %w", err)
	}

	if len(response.Errors) > 0 {
		err := response.Errors[0]
		return retryableStatus(err.Status), fmt.Errorf("anilist: graphql error: %s", err.Message)
	}

	return false, nil
}

// retryableStatus reports whether a status code is worth another attempt.
// AniList answers 429 when its rate limit is exhausted.
func retryableStatus(status int) bool {
	return status == http.StatusTooManyRequests || status >= http.StatusInternalServerError
}

// snippet returns a short, bounded excerpt of a response body for error
// messages, so a large HTML error page cannot flood the logs.
func snippet(body io.Reader) string {
	const limit = 256

	data, err := io.ReadAll(io.LimitReader(body, limit))
	if err != nil || len(data) == 0 {
		return "<empty body>"
	}
	return string(data)
}

// sleepCtx waits for d, returning early if ctx is cancelled.
func sleepCtx(ctx context.Context, d time.Duration) error {
	timer := time.NewTimer(d)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}
