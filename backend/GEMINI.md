# Backend Overview

This is the backend for the NekoRec anime recommendation system. It is a Python-based application built with the FastAPI framework.

## Key Technologies

- **Python:** The core programming language.
- **FastAPI:** A modern, high-performance web framework for building APIs.
- **MongoDB:** The primary database for storing anime data, user information, and other application-related data.
- **Uvicorn:** A lightning-fast ASGI server for running the FastAPI application.
- **Pydantic:** Used for data validation and settings management.
- **OpenRouter:** The OpenRouter API is used for generating embeddings (`baai/bge-m3`) and for the multi-model chatbot.

## Project Structure

- `app/`: The main application directory.
  - `/`: The main application directory.
  - `core/`: Cross-cutting infrastructure — settings (`config.py`), MongoDB clients and DB name (`deps.py`), Qdrant connection (`qdrant.py`), embedding client (`embeddings.py`), Auth0 JWT verification (`security.py`), SFW filtering (`sfw.py`), text cleaning (`text.py`), and custom exceptions.
  - `routers/`: API endpoints for `animes`, `recommendations`, `chatbot`, `ping`, and `watchlist`.
  - `schemas/`: Pydantic models for data validation and serialization.
  - `services/`: Business logic — recommendations via Qdrant vector search (`anime_recommendations.py`), embedding generation (`embeddings/generate.py`), and the `chatbot/` LangGraph RAG pipeline.
  - `grpc_server/`: The gRPC ingest server (aio) — `server.py` (bootstrap), `servicer.py` (stream RPC), `service.py` (Mongo upsert + Qdrant embed flush), `mapping.py` (proto → domain).
  - `grpc_stub/`: Generated Python protobuf stubs (committed; regenerate via `buf generate` after any `.proto` change).
  - `proto/anime/v1/ingest.proto`: The cross-language contract between the Go fetcher and this backend — append-only changes only, guarded by `buf breaking`.
  - `main.py`: The entry point of the FastAPI application.
- `fetch_anime.py`: Legacy script for fetching anime data (targets a URL that no longer exists; ingestion is the Go fetcher over gRPC — don't use it).
- `pyproject.toml`: The project's dependency and metadata configuration file.

## Running the Application

To run the backend server for development, use the following command:

```bash
uvicorn app.main:app --reload
```

This will start the server on `http://127.0.0.1:8000`, and it will automatically reload when code changes are detected.

To run the gRPC ingest server (separate process; the Go fetcher in `go-fetcher/` targets it):

```bash
PYTHONPATH=app/grpc_stub uv run python -m app.grpc_server.server
```

Any proto change requires regenerating both stubs — `buf generate` (updates `app/grpc_stub/` and `go-fetcher/gen/`) — and keeping `buf breaking` green.
