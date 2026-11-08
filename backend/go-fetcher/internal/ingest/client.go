// Client implements the fetch.Store seam over the Python backend's
// IngestService. One Upsert call == one client stream == one Mongo batch:
// the batching unit the old database.Store had (per BulkWrite call) survives
// unchanged, only the wire under it changed.
package ingest

import (
	"context"
	"fmt"

	pb "github.com/RaY8118/anime-recommendation/backend/go-fetcher/gen/anime/v1"

	"github.com/RaY8118/anime-recommendation/backend/go-fetcher/internal/fetch"
	"github.com/RaY8118/anime-recommendation/backend/go-fetcher/internal/models"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type Client struct {
	conn   *grpc.ClientConn
	client pb.IngestServiceClient
}

// NewClient dials the ingest server. grpc.NewClient is lazy: it does not
// connect here, no matter what names suggest — the first stream does. A
// health probe belongs to Stage 5 (an on-by-default Health RPC); for now
// connection failure surfaces as a failed first batch, which the fetcher
// already records and backfills correctly.
func NewClient(ctx context.Context, address string) (*Client, error) {
	conn, err := grpc.NewClient(address,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		return nil, fmt.Errorf("ingest: dial %s: %w", address, err)
	}
	return &Client{conn: conn, client: pb.NewIngestServiceClient(conn)}, nil
}

func (c *Client) Close() error {
	return c.conn.Close()
}

// Upsert implements fetch.Store.
//
// A batch with ANY rejected document is treated as a failed batch (the
// fetcher records the range and a later run backfills it). This is stricter
// than Mongo's unordered bulk — but with replace-upsert idempotency on the
// server, a strict-failure retry is harmless, while a partially-accepted
// batch that reports success could hide gaps in the dataset forever.
func (c *Client) Upsert(ctx context.Context, media []models.Media) (fetch.WriteResult, error) {
	if len(media) == 0 {
		return fetch.WriteResult{}, nil
	}

	stream, err := c.client.IngestAnimes(ctx)
	if err != nil {
		return fetch.WriteResult{}, fmt.Errorf("ingest: open stream: %w", err)
	}

	for _, item := range media {
		if err := stream.Send(Media(item)); err != nil {
			return fetch.WriteResult{}, fmt.Errorf("ingest: send anime %d: %w", item.ID, err)
		}
	}

	summary, err := stream.CloseAndRecv()
	if err != nil {
		return fetch.WriteResult{}, fmt.Errorf("ingest: finish stream: %w", err)
	}

	if summary.GetFailed() > 0 {
		return fetch.WriteResult{}, fmt.Errorf(
			"ingest: %d of %d anime rejected: %s",
			summary.GetFailed(), summary.GetReceived(), summary.GetMessage(),
		)
	}

	return fetch.WriteResult{
		Upserted: int64(summary.GetUpserted()),
		Matched:  int64(summary.GetMatched()),
		Modified: int64(summary.GetModified()),
	}, nil
}
