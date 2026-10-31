# Backend (FastAPI)

This directory contains the FastAPI backend for NekoRec. It exposes REST endpoints under `/v1/*`, connects to MongoDB, generates and queries vector embeddings for content-based recommendations, handles Auth0-protected routes, and powers the multi-model chatbot via OpenRouter/LangChain.

## Tech Stack

- **Python 3.12.3** (pinned in `pyproject.toml`)
- **FastAPI 0.116+** with **Uvicorn/Gunicorn** (production Docker uses `gunicorn` + `UvicornWorker`)
- **MongoDB** via `motor` (async) and `pymongo` (sync utils)
- **Qdrant Cloud** (`qdrant-client` + `langchain-qdrant`) — vector store for anime embeddings
- **Redis** — conversation history storage for the chatbot
- **Auth0** (`authlib`) for JWT verification
- **LangGraph / LangChain** (v1.x) + `langchain-openrouter` for the chatbot RAG pipeline
- **OpenRouter** (embeddings: `google/gemini-embedding-001`, chat models)
- **uv** for dependency management (`uv.lock`)

## App Structure

```text
backend/
├── app/
│   ├── main.py           # FastAPI app, routers, CORS, request-timing middleware, global exception handler
│   ├── dependencies.py   # MongoDB clients: get_mongo_client(), get_sync_mongo_client(), get_database() (DB="anime_recommendation")
│   ├── routers/
│   │   ├── animes.py      # Anime CRUD, search/filter, recommendations, chatbot (+ streaming/clear), suggestions, embeddings
│   │   ├── ping.py        # Health checks (public + Auth0-protected /private)
│   │   └── watchlist.py    # Auth0-protected watchlist endpoints
│   ├── schemas/
│   │   ├── animes.py      # Pydantic models for anime API
│   │   └── watchlist.py   # Pydantic models for watchlist
│   ├── services/
│   │   ├── anime_recommendations.py # Content-based recommendations via Qdrant vector search
│   │   └── chatbot/                  # LangGraph RAG chatbot pipeline
│   │       ├── graph.py    # Pipeline graph: extract query → retrieve → answer (sync + streaming)
│   │       ├── state.py    # LangGraph state definitions
│   │       ├── models.py   # LLM model registry / AVAILABLE_MODELS
│   │       ├── chat.py     # LLM invocation helpers
│   │       ├── retrieval.py# Qdrant filtered retrieval (genre/studio/season/score filters)
│   │       ├── saver.py    # Redis-backed chat history saver
│   │       └── config.py   # Redis/model config, prompts, timeouts
│   └── utils/
│       ├── anime_api.py                # AniList API helpers/fetch utilities
│       ├── anime_embedding_generation.py # Generate/store embeddings into Qdrant
│       ├── auth0_security.py           # Auth0 JWT verification (domain/audience)
│       ├── chatbot.py                  # Chatbot utilities (OpenRouter)
│       ├── clean_text.py               # Text preprocessing for embeddings
│       ├── embeddings.py               # Embedding helpers (OpenRouter Gemini embedding)
│       ├── fetch_status.py             # Fetch/status utilities
│       ├── qdrant_client.py            # Qdrant connection, `anime` collection + payload indexes
│       └── validate_params.py          # Request validation helpers
├── fetch_anime.py        # Legacy script (POSTs to /animes/fetch without /v1; 15s interval)
├── Dockerfile            # Multi-stage/uv-based build; runs gunicorn on PORT (default 8000)
├── .dockerignore         # ignores .venv, __pycache__
├── pyproject.toml        # Dependencies, requires-python ==3.12.3
└── uv.lock               # Locked dependency graph
```

## API Routers (mounted at `/v1`)

- **`/v1/animes`** (`routers/animes.py`): `POST /fetch`, `POST /recommendations`, `GET ""` (list), `POST /suggestions`, `GET /genres`, `GET /search`, `GET /filter`, `GET /random`, `GET /top-rated`, `GET /generate-embeddings`, `GET /{id}` (fetch by numeric ID), `GET /chatbot/models`, `POST /chatbot`, `POST /chatbot/stream` (SSE token streaming), `POST /chatbot/clear` (clears Redis chat history for a session)
- **`/v1/ping`** (`routers/ping.py`): `GET ""` (public), `GET /private` (Auth0-protected)
- **`/health`** (`main.py`): `GET` root-level liveness probe (no `/v1` prefix, no DB access); returns `{"status": "ok"}`
- **`/v1/models`** (`main.py`): `GET` alias for `/v1/animes/chatbot/models`; returns the chatbot model catalogue
- **`/v1/watchlist`** (`routers/watchlist.py`): `POST /add`, `GET /`, `GET /{anime_id}`, `DELETE /{anime_id}`, `PUT /{anime_id}` (all require Auth0 user)

> Note: The legacy `fetch_anime.py` targets `http://localhost:8000/animes/fetch` (missing `/v1`). Prefer the Go fetcher for bulk ingestion.

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
| `OPENROUTER_API_KEY` | Yes | — | Used for embeddings (`google/gemini-embedding-001`) and LLM chat |
| `QDRANT_CLOUD_ENDPOINT` | Yes (recommendations/chatbot) | — | Qdrant Cloud cluster URL |
| `QDRANT_CLOUD_API_KEY` | Yes (recommendations/chatbot) | — | Qdrant Cloud API key |
| `REDIS_URL` | Yes (chatbot) | — | Redis connection URL for chat session history |
| `REDIS_HISTORY_TTL` | No | `86400` | Chat history TTL in seconds |
| `ALLOWED_ORIGINS` | No | `*` | Comma-separated CORS origins (e.g. `http://localhost:5173,https://...`) |
| `ENV` | No | `DEVELOPMENT` | Controls CORS and runtime behavior |

> `GEMINI_API_KEY` is not referenced in backend Python code; embeddings/chat go through OpenRouter.

## Data Dependencies

- **Metadata**: Populated by `backend/go-fetcher` into `anime_recommendation.new_animes`.
- **Embeddings**: Generated by `app/utils/anime_embedding_generation.py` into the **Qdrant** collection `anime` (used by `/v1/animes/recommendations` and chatbot retrieval).
- **Chat history**: Stored in Redis (`app/services/chatbot/saver.py`), keyed by `session_id` with a TTL.
- **Source**: AniList GraphQL API.

## Notes

- DB name is hardcoded to `anime_recommendation` in `app/dependencies.py`.
- No Python test suite exists in this repo. For data contract validation, see Go tests (`TestBSONTagsMatchPythonContract` in `backend/go-fetcher/internal/models/media_bson_test.go`).