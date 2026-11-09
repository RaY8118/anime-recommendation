# AGENTS.md

Three independent components with different toolchains. Only Go has tests; CI stages run deploys only, so verify changes locally.

- `backend/` — FastAPI (Python pinned `==3.12.3` in `pyproject.toml`), deps via `uv` (`uv.lock`). Runs REST API (uvicorn, port 8000) **and** an aio gRPC ingest server (`app/grpc_server/`, port `GRPC_PORT`, default 50051) as two separate processes.
- `frontend/` — React 19 + Vite 7 + TanStack Query + Tailwind v4; has both npm and Bun lockfiles, CI builds with **Bun**
- `backend/go-fetcher/` — standalone Go module ingesting AniList → **streams to the Python gRPC server** (which does Mongo upserts + Qdrant embedding). No Mongo driver, no BSON tags.

## Commands

Backend REST API (won't start without `backend/.env`; `MONGODB_URI` is the only required var):

```bash
cd backend && uv venv && source .venv/bin/activate && uv sync --locked
uvicorn app.main:app --reload        # docs at /docs
```

Backend gRPC ingest server (separate process; the fetcher targets this):

```bash
cd backend && PYTHONPATH=app/grpc_stub uv run python -m app.grpc_server.server
```

Frontend (`npm run build` = `tsc -b && vite build` — running build is the typecheck; no tests):

```bash
cd frontend && npm install && npm run dev   # dev server on 5173
npm run lint && npm run build               # verify after TS changes
```

Go fetcher (module root is `backend/go-fetcher/`; loads `.env` from `./`, `../`, or `backend/`; target is `GRPC_INGEST_ADDR`, default `localhost:50051`):

```bash
cd backend/go-fetcher
go run ./cmd/fetcher                  # needs the gRPC server running, else the batch is recorded as failed range
go test ./... && go vet ./...
```

Protobuf contract (single source of truth at `backend/app/proto/anime/v1/ingest.proto`; regenerate after ANY proto change):

```bash
buf generate && buf lint              # regenerates Go (backend/go-fetcher/gen) + Python (backend/app/grpc_stub)
buf breaking --against ".git#commit=$(git rev-parse HEAD~1),subdir=backend/app/proto"
```

## Structure

- Backend layout: `app/core/` (config, deps, qdrant, embeddings, auth0 security, sfw, text cleaning, validate, exceptions), `app/routers/` (animes, recommendations, chatbot, ping, watchlist), `app/services/` (anime_recommendations, embeddings/generate.py, `chatbot/` LangGraph RAG), `app/grpc_server/` (mapping, service, servicer, server — the gRPC side), `app/grpc_stub/` (generated, committed).
- All API routes mount under `/v1`; the `recommendations` and `chatbot` routers share the `/v1/animes` prefix → `/v1/animes/recommendations`, `/v1/animes/chatbot*`. `/health` is the only root-level route (Render probe, no DB access). There is **no** `POST /v1/animes/fetch` — ingest is the Go fetcher via gRPC only.
- DB name from `app/core/deps.py` (`DB_NAME`, currently `anime_recommendation`); Mongo collections `new_animes` + `suggestions`; Qdrant collection `anime` for embeddings. Embeddings/chat use **OpenRouter** with `OPENROUTER_API_KEY` (`GEMINI_API_KEY` is dead config).
- Ingest flow: `cmd/fetcher` walks AniList ID ranges → transforms → streams `IngestAnimeRequest`s → Python `IngestAnimes(stream)` → validate (`Anime` schema) → one unordered `ReplaceOne` bulk_write on `new_animes` at end-of-stream → single Qdrant embed flush. `GET /v1/animes/generate-embeddings?force=` remains as the full re-index path. Legacy `backend/fetch_anime.py` targets a broken URL — don't use it.

## Cross-language contract (proto + presence, guarded)

The proto is the contract — it replaced the old hand-synced BSON tags. The presence chain Go pointer ↔ proto3 `optional` ↔ Mongo null is enforced three ways: `internal/ingest/mapping_test.go` (Go nil→unset), `app/grpc_server/mapping.py` (unset→None→pydantic), and `buf breaking` (wire compat). Rules: proto changes are **append-only** (never renumber existing fields), require `buf generate` on both language outputs in the same commit, and `buf breaking` must stay green. IngestSummary counters (`inserted/upserted/matched/modified/embedded/failed`) are what the fetcher's backfill reporting depends on — keep Python's semantics aligned with Go's failed-range model (any rejected doc fails the whole batch, retry is safe via replace-upsert).

## Deploy

Push to `master` auto-deploys: `backend/**` → Docker Hub (`ray8118/anime-recommendations`) → Render hook; `frontend/**` → Bun build → Cloudflare Pages (`nekorec`). No test/lint gate in CI, so run checks locally first. The gRPC ingest server and fetcher are currently **dev/local-only** — they are not wired into the Docker/Render deployment; a Render rollout decision is deliberately deferred until they prove out.
