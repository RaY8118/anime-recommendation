# go-fetcher

Ingests anime metadata from the [AniList](https://anilist.co) GraphQL API into
MongoDB for the anime recommendation backend.

The Python service (`backend/app/`) owns serving the API and generating vector
embeddings. This binary only fills the `new_animes` collection; run
`backend/app/utils/anime_embedding_generation.py` afterwards to build the
`embeddings` collection.

## Layout

| Path | Responsibility |
| --- | --- |
| `cmd/fetcher` | Entry point: wiring, signal handling, run summary |
| `internal/config` | Environment configuration and validation |
| `internal/anilist` | GraphQL client, query, retry with backoff |
| `internal/transform` | AniList wire types to domain documents |
| `internal/models` | Domain and wire types, BSON field names |
| `internal/database` | MongoDB connection and idempotent writes |
| `internal/fetch` | Walks the ID range, drives the ingest |

## Running

```bash
cd backend/go-fetcher
go run ./cmd/fetcher
```

The binary looks for `.env`, `../.env`, then `backend/.env`, so it can be run
from the repository root or from the backend directory. Only `MONGODB_URI` is
required.

## Configuration

Every value can be overridden with an environment variable. Defaults reproduce
the previous hardcoded behaviour, so an unconfigured run behaves the same.

| Variable | Default | Notes |
| --- | --- | --- |
| `MONGODB_URI` | *required* | Connection string |
| `MONGO_DATABASE` | `anime_recommendation` | |
| `MONGO_COLLECTION` | `new_animes` | Shared with the Python API |
| `ANILIST_ENDPOINT` | `https://graphql.anilist.co` | |
| `ANIME_START_ID` | `200` | First AniList ID to request |
| `ANIME_TOTAL_ID` | `10000` | Last AniList ID to request |
| `ANIME_BATCH_SIZE` | `50` | Max 50; AniList caps a page at 50 |
| `FETCH_REQUEST_DELAY` | `3s` | Pause between batches |
| `FETCH_REQUEST_TIMEOUT` | `30s` | Per-request HTTP timeout |
| `FETCH_MAX_RETRIES` | `3` | Retries per batch on 429/5xx |
| `FETCH_RETRY_BASE_DELAY` | `2s` | Exponential backoff base |
| `MONGO_TIMEOUT` | `30s` | Connect and disconnect timeout |

AniList advertises its current budget in the `X-RateLimit-Limit` header, which
was `30` requests per minute when this was written. The default 3s delay
corresponds to 20 requests per minute, which leaves headroom. If you see
`429` responses, raise `FETCH_REQUEST_DELAY`.

## Writes

Documents are written with a replace-upsert keyed on `id`, so re-running the
fetcher refreshes existing entries instead of duplicating them. Each batch is
committed as it is fetched, so an interrupted run keeps everything it had
already stored.

A batch that still fails after its retries is recorded and skipped rather than
aborting the run. Skipped ranges are listed at the end and the process exits
non-zero. To backfill one, narrow the run with `ANIME_START_ID` and
`ANIME_TOTAL_ID`.

## Field names are a shared contract

The BSON keys are read by the Python API and the React frontend, which expect
`averageScore` and `seasonYear`. The mongo driver's implicit default is to
lower-case the Go field name, which would write `averagescore` and `seasonyear`
and silently break the top-rated sort, the score and year filters, and the score
display. Every field in `internal/models/media.go` therefore carries an explicit
`bson` tag, and `TestBSONTagsMatchPythonContract` guards the full key set.

Nullable AniList fields are stored as BSON `null` rather than as `0` or `""`,
matching the `Optional[...]` fields the Python ingest path writes.

## Tests

```bash
go test ./...
go vet ./...
```