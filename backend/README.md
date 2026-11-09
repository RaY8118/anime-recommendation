# Backend (FastAPI)

This directory contains the FastAPI backend for NekoRec. It exposes REST endpoints under `/v1/*`, connects to MongoDB, generates and queries vector embeddings for content-based recommendations, handles Auth0-protected routes, and powers the multi-model chatbot via OpenRouter/LangChain.

## Tech Stack

- **Python 3.12.3** (pinned in `pyproject.toml`)
- **FastAPI 0.116+** with **Uvicorn/Gunicorn** (production Docker uses `gunicorn` + `UvicornWorker`)
- **MongoDB** via `motor` (async) and `pymongo` (sync utils)
- **gRPC (grpc.aio)** — ingest server (`app/grpc_server/`) that receives the Go fetcher's anime stream and does Mongo upserts + end-of-stream Qdrant embedding flush
- **Qdrant Cloud** (`qdrant-client` + `langchain-qdrant`) — vector store for anime embeddings
- **Redis** — conversation history storage for the chatbot
- **Auth0** (`authlib`) for JWT verification
- **LangGraph / LangChain** (v1.x) + `langchain-openrouter` for the chatbot RAG pipeline
- **OpenRouter** (embeddings via `baai/bge-m3`, chat models)
- **uv** for dependency management (`uv.lock`)

## App Structure

```text
backend/
├── app/
│   ├── main.py             # FastAPI app, routers, CORS, request-timing middleware, global exception handler
│   ├── core/
│   │   ├── config.py       # Pydantic Settings (env_file=".env"): env, allowed_origins, mongodb_uri, auth0/openrouter/qdrant/redis vars
│   │   ├── deps.py         # MongoDB clients: get_mongo_client(), get_sync_mongo_client(), get_database() (DB="anime_recommendation")
│   │   ├── embeddings.py   # OpenRouter embedding client (OpenAIEmbeddings, model baai/bge-m3)
│   │   ├── qdrant.py       # Qdrant connection, `anime` collection + payload indexes, BATCH_SIZE
│   │   ├── security.py     # Auth0 JWT verification (JWKS from AUTH0_DOMAIN)
│   │   ├── sfw.py          # SFW filters (Mongo filter + adult-genre checks for Qdrant)
│   │   ├── text.py         # Text preprocessing (clean_html) for descriptions
│   │   ├── validate.py     # Unexpected-parameter validation helper
│   │   └── exceptions.py   # Custom HTTPException subclasses
│   ├── grpc_server/        # gRPC ingest side (aio): server.py, servicer.py, service.py, mapping.py
│   ├── grpc_stub/          # Generated Python protobuf stubs (committed; from app/proto via buf)
│   ├── proto/anime/v1/     # ingest.proto — the cross-language contract (Go fetcher ↔ Python)
│   ├── routers/
│   │   ├── animes.py          # List/search/filter/genres/random/top-rated, POST /suggestions, GET /generate-embeddings, GET /{id}
│   │   ├── recommendations.py # POST /recommendations (mode: description | genre | anime_name)
│   │   ├── chatbot.py         # Models list, chat, /chatbot/stream (SSE), /chatbot/clear
│   │   ├── ping.py            # Health checks (public + Auth0-protected /private)
│   │   └── watchlist.py       # Auth0-protected watchlist endpoints
│   ├── schemas/
│   │   ├── animes.py, recommendations.py, chatbot.py   # Pydantic models (chatbot includes AVAILABLE_MODELS)
│   │   ├── watchlist.py     # Pydantic models for watchlist
│   │   └── common.py        # Shared response models (AnimeListResponse, MessageResponse)
│   └── services/
│       ├── anime_recommendations.py   # Content-based recommendations via Qdrant (description/genre/name modes)
│       ├── embeddings/generate.py     # Batch generate/store embeddings into Qdrant from new_animes (skips existing unless force=True)
│       └── chatbot/                   # LangGraph RAG chatbot pipeline
│           ├── graph.py    # Pipeline graph: extract query → retrieve → answer (sync + streaming)
│           ├── state.py    # LangGraph state definitions
│           ├── models.py   # LLM model registry
│           ├── chat.py     # LLM invocation helpers
│           ├── retrieval.py# Qdrant filtered retrieval (genre/studio/season/score filters)
│           ├── saver.py    # Redis-backed chat history saver
│           └── config.py   # Redis/model config, prompts, timeouts
├── fetch_anime.py        # Legacy script (POSTs to /animes/fetch without /v1; 15s interval)
├── Dockerfile            # uv-based build; runs gunicorn on PORT (default 8000)
├── pyproject.toml        # Dependencies, requires-python ==3.12.3
└── uv.lock               # Locked dependency graph
```

## API Routers (mounted at `/v1` in `app/main.py`)

The three anime-related routers share the `/v1/animes` prefix:

- **`routers/animes.py`**: `GET ""` (paginated list), `POST /suggestions`, `GET /genres`, `GET /search`, `GET /filter`, `GET /random`, `GET /top-rated`, `GET /generate-embeddings?force=` (Qdrant embedding build), `GET /{id}` (fetch by numeric ID). There is **no** `POST /fetch` — ingest is the Go fetcher via gRPC only.
- **`routers/recommendations.py`**: `POST /recommendations` (query + `mode` query param: `description` | `genre` | `anime_name`, `top_k`, `sfw`)
- **`routers/chatbot.py`**: `GET /chatbot/models`, `POST /chatbot`, `POST /chatbot/stream` (SSE token streaming), `POST /chatbot/clear` (clears Redis chat history for a session)
- **`/v1/ping`** (`routers/ping.py`): `GET ""` (public), `GET /private` (Auth0-protected)
- **`/health`** (`main.py`): `GET` root-level liveness probe (no `/v1` prefix, no DB access); returns `{"status": "ok"}`
- **`/v1/models`** (`main.py`): `GET` alias for `/v1/animes/chatbot/models`; returns the chatbot model catalogue
- **`/v1/watchlist`** (`routers/watchlist.py`): `POST /add`, `GET /`, `GET /{anime_id}`, `DELETE /{anime_id}`, `PUT /{anime_id}` (all require Auth0 user)

> Note: The legacy `fetch_anime.py` targets `http://localhost:8000/animes/fetch` (missing `/v1`) against a route that no longer exists. Don't use it — ingestion is the Go fetcher over gRPC.

## Setup & Run

```bash
cd backend
pip install uv
uv venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
uv sync --locked
```

Create `.env` (see Environment Variables). Dev server:

```bash
uvicorn app.main:app --reload
# http://127.0.0.1:8000  (Swagger at /docs, Redoc at /redoc)
```

### gRPC ingest server (separate process, dev/local-only)

The Go fetcher streams anime entries to this, not to the REST API:

```bash
cd backend && PYTHONPATH=app/grpc_stub uv run python -m app.grpc_server.server
# listens on GRPC_PORT (default 50051); target from the fetcher side is GRPC_INGEST_ADDR
```

Docker (production):

```bash
docker build -t nekorec-backend .
docker run -p 8000:8000 --env-file .env nekorec-backend
# Runs: gunicorn app.main:app -k uvicorn.workers.UvicornWorker --workers 2 --bind 0.0.0.0:${PORT:-8000} --timeout 60 --access-logfile -
```

## Environment Variables

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `MONGODB_URI` | Yes | — | MongoDB connection string |
| `AUTH0_DOMAIN` | Yes (auth routes) | — | e.g. `your-tenant.auth0.com` |
| `AUTH0_API_AUDIENCE` | Yes | — | Auth0 API audience/identifier |
| `OPENROUTER_API_KEY` | Yes | — | Used for embeddings (`baai/bge-m3`) and LLM chat |
| `QDRANT_CLOUD_ENDPOINT` | Yes (recommendations/chatbot) | — | Qdrant Cloud cluster URL |
| `QDRANT_CLOUD_API_KEY` | Yes (recommendations/chatbot) | — | Qdrant Cloud API key |
| `REDIS_URL` | Yes (chatbot) | — | Redis connection URL for chat session history |
| `REDIS_HISTORY_TTL` | No | `86400` | Chat history TTL in seconds |
| `ALLOWED_ORIGINS` | No | `*` | Comma-separated CORS origins (e.g. `http://localhost:5173,https://...`) |
| `ENV` | No | `DEVELOPMENT` | Controls CORS and runtime behavior |
| `GRPC_PORT` | No | `50051` | Port for the gRPC ingest server (`app/grpc_server/server.py`) |

> `GEMINI_API_KEY` is not referenced in backend Python code; embeddings/chat go through OpenRouter.

## Data Dependencies

- **Metadata**: Populated by `backend/go-fetcher` streaming over gRPC (`GRPC_INGEST_ADDR`) into `anime_recommendation.new_animes` — the Python servicer validates each document against the `Anime` schema and bulk-replaces at end-of-stream.
- **Embeddings**: Generated by `app/services/embeddings/generate.py` via `GET /v1/animes/generate-embeddings` into the **Qdrant** collection `anime` (used by `/v1/animes/recommendations` and chatbot retrieval); the gRPC servicer reuses the same document-builder for its end-of-stream embed flush.
- **Chat history**: Stored in Redis (`app/services/chatbot/saver.py`), keyed by `session_id` with a TTL.
- **Source**: AniList GraphQL API.

## Notes

- DB name comes from `DB_NAME` in `app/core/deps.py` (currently `anime_recommendation`).
- The proto contract (`app/proto/anime/v1/ingest.proto`) is the source of truth for the Go↔Python field mapping — proto changes are append-only and require `buf generate` + `buf breaking` (see root `AGENTS.md`). No Python test suite exists; `buf lint`/`buf breaking` plus the Go tests are the guardrails.