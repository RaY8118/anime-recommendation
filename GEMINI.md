
# Project Overview

This is a full-stack web application for anime recommendations. The backend is built with Python and FastAPI, and the frontend is a React application written in TypeScript.

## Technologies Used

### Backend

- Python
- FastAPI
- MongoDB
- OpenRouter for embeddings (`baai/bge-m3`) and the multi-model chatbot

### Frontend

- React
- TypeScript
- Vite
- Tanstack Query
- Tailwind CSS

## API Endpoints

The backend exposes the following endpoints under the `/v1/animes` prefix (all routes mount under `/v1`):

- `POST /recommendations`: Recommends anime based on a query.
- `GET /`: Retrieves a paginated list of anime with optional filters.
- `POST /suggestions`: Adds a new anime suggestion.
- `GET /genres`: Retrieves a list of all available genres.
- `GET /search`: Searches for anime by name.
- `GET /filter`: Filters anime by genre.
- `GET /random`: Retrieves a random anime.
- `GET /top-rated`: Retrieves a list of top-rated anime.
- `GET /{anime_name}`: Retrieves a specific anime by name.
- `POST /chatbot`: Interacts with the chatbot.

## Frontend Services

The `frontend/src/services/api.ts` file contains functions for making API requests to the backend. These functions are used to fetch and manage data for the application. Key functions include:

- `getAllAnimes`: Fetches a list of animes with optional filters.
- `getAnimeByName`: Fetches a single anime by its name.
- `getRecommendations`: Fetches anime recommendations based on a query.
- `getGenres`: Fetches a list of all available genres.
- `searchAnime`: Searches for animes by name.
- `suggestAnime`: Submits a new anime suggestion.
- `getRandomAnime`: Fetches a random anime.
- `getTopRated`: Fetches a list of top-rated animes.
- `sendChatMessage`: Sends a message to the chatbot.
- `getWatchlist`: Fetches the user's watchlist.
- `addToWatchlist`: Adds an anime to the user's watchlist.
- `deleteFromWatchlist`: Removes an anime from the user's watchlist.
- `updateWatchlistStatus`: Updates the status of an anime in the user's watchlist.

## Data Ingestion

Ingestion is a gRPC pipeline, not a REST endpoint: the Go fetcher at `backend/go-fetcher` walks AniList ID ranges and streams entries to the Python ingest server at `backend/app/grpc_server/` (protocol defined in `backend/app/proto/anime/v1/ingest.proto`). The Python servicer validates each document against the `Anime` schema, bulk-replaces them into the `new_animes` collection at end-of-stream, and flushes embeddings into Qdrant. The old `backend/app/services/ingest/anilist.py` fetch path and `POST /v1/animes/fetch` endpoint have been deleted.

## Embeddings

`backend/app/services/embeddings/generate.py` builds vector embeddings from the anime descriptions and upserts them into the **Qdrant** collection `anime`. It is triggered by `GET /v1/animes/generate-embeddings` (use `?force=true` to re-index everything).

## Chatbot

The chatbot lives in `backend/app/services/chatbot/` and is implemented as a LangGraph RAG pipeline: it extracts search constraints from the user's message, retrieves similar anime from Qdrant, and streams the LLM response over SSE (via OpenRouter models). Conversation history is stored in Redis with a TTL (`app/services/chatbot/saver.py`).

## Building and Running

### Backend

The backend runs as **two separate processes in dev** — uvicorn serves the REST API, the gRPC ingest server receives the Go fetcher's stream:

```bash
cd backend
uvicorn app.main:app --reload                                        # REST API on 8000
PYTHONPATH=app/grpc_stub uv run python -m app.grpc_server.server     # gRPC ingest on 50051
```

### Frontend

To run the frontend development server:

```bash
cd frontend
npm run dev
```

## Development Conventions

The project uses `uv` for Python package management and `npm` or `bun` for the frontend. The backend follows standard FastAPI project structure, and the frontend is a typical Vite-based React application.
