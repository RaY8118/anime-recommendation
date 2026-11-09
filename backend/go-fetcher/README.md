# go-fetcher (AniList → gRPC streamer)

A standalone Go binary that fetches anime metadata from the [AniList GraphQL API](https://anilist.co/) and **streams it over gRPC** to the Python ingest server (`backend/app/grpc_server/`). It does not talk to MongoDB at all — the Python side validates, upserts into Mongo (`new_animes`), and flushes embeddings into Qdrant at end-of-stream.

This mirrors the modern service topology: Go owns fetching/transforming (its strength), Python owns persistence + embeddings (where the schemas live).

## Layout

| Path | Responsibility |
| --- | --- |
| `cmd/fetcher/` | Entry point: config wiring, .env loading, signal handling, run summary |
| `internal/anilist/` | GraphQL client, query, retry with exponential backoff |
| `internal/config/` | Environment configuration and validation |
| `internal/fetch/` | Walks ID range, drives the ingest loop, records skipped ranges; defines the `Store` seam + `WriteResult` |
| `internal/ingest/` | gRPC client implementing `fetch.Store` (one client-stream per batch); `mapping.go` converts domain → proto with the presence contract |
| `internal/models/` | Domain (`media.go`) and AniList wire (`anilist.go`) types — no BSON tags; nullability is pointers |
| `internal/transform/` | AniList wire types → domain documents; HTML cleaning and normalization |
| `gen/` | Generated protobuf Go code (from `backend/app/proto/anime/v1/ingest.proto` via `buf generate`) |

## Module Info

- **Module:** `github.com/RaY8118/anime-recommendation/backend/go-fetcher`
- **Go:** `1.27.0`
- **Key deps:** `github.com/joho/godotenv v1.5.1`, `google.golang.org/grpc`, generated stubs under `gen/`

## Running

The gRPC ingest server must be up first (two-process topology):

```bash
# terminal 1 — Python ingest server (port 50051 by default)
cd backend && PYTHONPATH=app/grpc_stub uv run python -m app.grpc_server.server

# terminal 2 — fetcher
cd backend/go-fetcher
go run ./cmd/fetcher
```

If the server is down, each affected batch is recorded as a failed range and the process exits non-zero — retry is safe (upserts are idempotent).

The binary auto-loads `.env` from `./`, `../`, then `backend/`. No variable is *required* — `GRPC_INGEST_ADDR` defaults to `localhost:50051`.

After ingest completes, generate/embed check on the Python side as needed:

```bash
curl -X GET "http://127.0.0.1:8000/v1/animes/generate-embeddings?force=false"
```

## Configuration

All values can be overridden via environment variables.

| Variable | Default | Notes |
| --- | --- | --- |
| `GRPC_INGEST_ADDR` | `localhost:50051` | Address of the Python `IngestService` |
| `INGEST_TIMEOUT` | `30s` | Timeout gRPC stream deadline per batch |
| `ANILIST_ENDPOINT` | `https://graphql.anilist.co` | AniList GraphQL endpoint |
| `ANIME_START_ID` | `10100` | First AniList ID to request |
| `ANIME_TOTAL_ID` | `15000` | Last AniList ID to request |
| `ANIME_BATCH_SIZE` | `50` | Max 50 (AniList page cap) |
| `FETCH_REQUEST_DELAY` | `3s` | Pause between batches (0 disables pacing) |
| `FETCH_REQUEST_TIMEOUT` | `30s` | Per-request HTTP timeout |
| `FETCH_MAX_RETRIES` | `3` | Retries per batch on 429/5xx/network errors (0 disables retry) |
| `FETCH_RETRY_BASE_DELAY` | `2s` | Exponential backoff base delay |

> AniList rate limit was ~30 req/min at time of writing; default 3s delay (~20 req/min) leaves headroom. If you see 429s, increase `FETCH_REQUEST_DELAY`.

## Cross-Language Contract (Critical)

The Go domain types and Python's persisted documents are bridged by the protobuf contract at `backend/app/proto/anime/v1/ingest.proto` — proto3 `optional` fields encode presence, which is exactly what nullable AniList fields need:

- **Go pointer → proto unset/value** — guarded by `internal/ingest/mapping_test.go` (nil must map to unset, not zero value).
- **Python unset → Mongo null** — guarded by `app/grpc_server/mapping.py` + the pydantic `Anime` schema.
- **Wire compatibility** — guarded by `buf breaking` against the previous commit:

```bash
buf breaking --against ".git#commit=$(git rev-parse HEAD~1),subdir=backend/app/proto"
```

Proto changes are **append-only** (never renumber/retype existing fields) and require regenerating both stubs (`buf generate`) in the same commit. Those compiled/tested contracts replaced the old hand-synced BSON tags.

## Failure Semantics and Backfill

- **Idempotent upserts**: Python `IngestAnimes` replaces documents keyed on `id` (`ReplaceOne` upsert), so re-running refreshes existing entries instead of duplicating.
- **Strict per-batch failure**: if any document in a batch stream is rejected (validation or write), the whole batch reports failure and no partial state is committed for it.
- **Resumable**: each successfully ingested batch is committed immediately; an interrupted run keeps prior batches.
- **Skip-and-report**: a batch that still fails after retries is recorded as a *failed range*, processing continues; at the end failed ranges are printed and the run summary exits non-zero.
- **Backfill a range**: narrow `ANIME_START_ID`/`ANIME_TOTAL_ID` to the reported window and re-run — the summary counters (`upserted`, `matched`, `modified`) tell you whether anything actually changed (a fully-new window reports `upserted=count`; a fully-matching replay reports `upserted=0 matched=count modified=count`, the idempotency signature).
- **Signal handling**: SIGINT/SIGTERM stop the fetcher gracefully and flush a run summary with non-zero exit if any ranges were skipped.

## Indexes

The read path needs three indexes on `new_animes`, all present in the deployed database (maintained on the Python/Mongo side):

| Index | Purpose |
| --- | --- |
| `id_1` (unique) | One document per anime id, makes Python's `ReplaceOne` upsert correct under concurrency |
| `averageScore_-1` | Top-rated sort in `animes.py` |
| `seasonYear_-1` | Season/year filter |

## Tests & Quality

```bash
go test ./...            # Unit tests; no network and no gRPC server required
go test -race ./...      # Same, with the race detector
go vet ./...             # Static analysis
```

| Test file | Covers |
| --- | --- |
| `internal/fetch/fetcher_test.go` | The ingest loop: ID-range walking, batch clamping, skip-and-continue on failed fetch/write, context cancellation, inter-batch pacing, option defaults |
| `internal/config/config_test.go` | Env parsing, defaults, malformed values, and every `Validate` rule and boundary |
| `internal/anilist/client_test.go` | GraphQL request shape, batch-size guard, GraphQL error array, retry on 5xx (via `httptest`) |
| `internal/ingest/mapping_test.go` | Domain → proto mapping, Go nil → proto unset presence contract |
| `internal/transform/media_test.go` | HTML cleaning, title normalisation, null vs empty-slice handling |
