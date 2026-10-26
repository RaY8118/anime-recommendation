# go-fetcher (AniList → MongoDB Ingestor)

A standalone Go binary that ingests anime metadata from the [AniList GraphQL API](https://anilist.co/) into MongoDB for the NekoRec backend.

The Python service (`backend/app/`) serves the API and generates vector embeddings. This tool only populates the `new_animes` collection; after running it, execute `backend/app/utils/anime_embedding_generation.py` to build the `embeddings` collection.

## Layout

| Path | Responsibility |
| --- | --- |
| `cmd/fetcher/` | Entry point: config wiring, .env loading, signal handling, run summary |
| `internal/anilist/` | GraphQL client, query, retry with exponential backoff |
| `internal/config/` | Environment configuration and validation |
| `internal/database/` | MongoDB connection (mongo-driver v2) and idempotent writes |
| `internal/fetch/` | Walks ID range, drives the ingest loop, records skipped ranges |
| `internal/models/` | Domain (`media.go`) and AniList wire (`anilist.go`) types with explicit BSON tags; BSON contract tests |
| `internal/transform/` | AniList wire types → domain documents; HTML cleaning and normalization |

## Module Info

- **Module:** `github.com/RaY8118/anime-recommendation/backend/go-fetcher`
- **Go:** `1.27.0`
- **Key deps:** `github.com/joho/godotenv v1.5.1`, `go.mongodb.org/mongo-driver/v2 v2.9.1`

## Running

```bash
cd backend/go-fetcher
go run ./cmd/fetcher
```

The binary auto-loads `.env` from `.env`, `../.env`, then `backend/.env`, so you can run it from repo root, `backend/`, or `backend/go-fetcher/`. Only `MONGODB_URI` is required.

After ingest completes, generate embeddings:

```bash
cd backend
source .venv/bin/activate
python app/utils/anime_embedding_generation.py
```

## Configuration

All values can be overridden via environment variables. Defaults match the previous hardcoded behavior.

| Variable | Default | Notes |
| --- | --- | --- |
| `MONGODB_URI` | *required* | MongoDB connection string |
| `MONGO_DATABASE` | `anime_recommendation` | Shared with Python backend |
| `MONGO_COLLECTION` | `new_animes` | Metadata collection (Python reads/writes against this) |
| `ANILIST_ENDPOINT` | `https://graphql.anilist.co` | AniList GraphQL endpoint |
| `ANIME_START_ID` | `10100` | First AniList ID to request |
| `ANIME_TOTAL_ID` | `15000` | Last AniList ID to request |
| `ANIME_BATCH_SIZE` | `50` | Max 50 (AniList page cap) |
| `FETCH_REQUEST_DELAY` | `3s` | Pause between batches |
| `FETCH_REQUEST_TIMEOUT` | `30s` | Per-request HTTP timeout |
| `FETCH_MAX_RETRIES` | `3` | Retries per batch on 429/5xx/network errors |
| `FETCH_RETRY_BASE_DELAY` | `2s` | Exponential backoff base delay |
| `MONGO_TIMEOUT` | `30s` | Connect/disconnect timeout |

> AniList rate limit was ~30 req/min at time of writing; default 3s delay (~20 req/min) leaves headroom. If you see 429s, increase `FETCH_REQUEST_DELAY`.

## Writes & Behavior

- **Idempotent upserts**: Documents are written with a replace-upsert keyed on `id`, so re-running refreshes existing entries instead of creating duplicates.
- **Resumable/partial-safe**: Each batch is committed as fetched. If interrupted, previously stored batches remain.
- **Graceful failures**: A batch that still fails after retries is recorded as skipped (range listed in run summary) and the process continues. Skipped ranges are printed at the end and the process exits non-zero. To backfill a specific range, run with narrowed `ANIME_START_ID`/`ANIME_TOTAL_ID`.
- **Signal handling**: On SIGINT/SIGTERM, the fetcher stops gracefully, flushes run summary, and exits non-zero if any ranges were skipped.

## BSON Contract (Critical)

The Python API and React frontend expect specific field names (e.g. `averageScore`, `seasonYear`). Because the mongo-driver v2 lowercases Go struct field names by default, explicit `bson` tags are required on every persisted field in `internal/models/media.go`.

- Every persisted key has an explicit `bson` tag.
- `TestBSONTagsMatchPythonContract` (`internal/models/media_bson_test.go`) guards the full key set against the Python contract.
- Nullable AniList fields are stored as BSON `null` (not `0`/`""`), matching Python `Optional[...]` semantics.

## Indexes

The read path needs three indexes on `new_animes`, all of which are already
present in the deployed database:

| Index | Purpose |
| --- | --- |
| `id_1` (unique) | Guarantees one document per anime id and makes the upsert efficient |
| `averageScore_-1` | Top-rated sort in `animes.py` |
| `seasonYear_-1` | Season/year filter |

The unique index is what makes the upsert in `internal/database/mongo.go`
correct — without it, two concurrent runs could insert the same anime twice.

## Tests & Quality

```bash
go test ./...            # Unit tests, no database and no network required
go test -race ./...      # Same, with the race detector
go vet ./...             # Static analysis
go test -cover ./...     # Statement coverage per package
```

| Test file | Covers |
| --- | --- |
| `internal/fetch/fetcher_test.go` | The ingest loop: ID-range walking, batch clamping, skip-and-continue on failed fetch/write, context cancellation, inter-batch pacing, option defaults |
| `internal/config/config_test.go` | Env parsing, defaults, malformed values, and every `Validate` rule and boundary |
| `internal/anilist/client_test.go` | GraphQL request shape, batch-size guard, GraphQL error array, retry on 5xx (via `httptest`) |
| `internal/transform/media_test.go` | HTML cleaning, title normalisation, null vs empty-slice handling |
| `internal/models/media_bson_test.go` | BSON key set matches the Python contract exactly |

Current statement coverage: `config` 100%, `transform` 92%, `fetch` 88%, `anilist` 88%.
`internal/database` has no unit tests — `Connect`/`Upsert` are thin wrappers over
the driver and only meaningful against a real deployment.