# AGENTS.md

Three independent components with different toolchains. Only Go has tests; CI stages run deploys only, so verify changes locally.

- `backend/` — FastAPI (Python pinned `==3.12.3` in `pyproject.toml`), deps via `uv` (`uv.lock`)
- `frontend/` — React 19 + Vite 7 + TanStack Query + Tailwind v4; has both npm and Bun lockfiles, CI builds with **Bun**
- `backend/go-fetcher/` — standalone Go module ingesting AniList → MongoDB `anime_recommendation.new_animes`

## Commands

Backend (won't start without `backend/.env`; `MONGODB_URI` is the only required var):

```bash
cd backend && uv venv && source .venv/bin/activate && uv sync --locked
uvicorn app.main:app --reload        # docs at /docs
```

Frontend (`npm run build` = `tsc -b && vite build` — running build is the typecheck; no tests):

```bash
cd frontend && npm install && npm run dev   # dev server on 5173
npm run lint && npm run build               # verify after TS changes
```

Go fetcher (module root is `backend/go-fetcher/`; loads `.env` from `./`, `../`, or `backend/`, so `MONGODB_URI` in `backend/.env` is reused):

```bash
cd backend/go-fetcher
go run ./cmd/fetcher
go test ./... && go vet ./...        # also run after schema/bson changes
```

## Structure

- Backend layout: `app/core/` (config, deps, qdrant, embeddings, auth0 security, sfw, text cleaning), `app/routers/`, `app/services/` (`chatbot/` LangGraph RAG, `ingest/anilist.py`, `embeddings/generate.py`).
- All API routes mount under `/v1`; the `recommendations` and `chatbot` routers share the `/v1/animes` prefix → `/v1/animes/recommendations`, `/v1/animes/chatbot*`. `/health` is the only root-level route (Render probe, no DB access).
- DB name hardcoded `anime_recommendation` in `app/core/deps.py`; Mongo collections `new_animes` + `suggestions`; Qdrant collection `anime` for embeddings. Embeddings/chat use **OpenRouter** with `OPENROUTER_API_KEY` (`GEMINI_API_KEY` is dead config).
- Bulk ingest: go-fetcher. Incremental: `POST /v1/animes/fetch`. Embeddings: `GET /v1/animes/generate-embeddings?force=`. Legacy `backend/fetch_anime.py` POSTs to a URL without `/v1` — don't use it.

## Cross-language BSON contract (breaks silently)

Go writes anime documents that Python and React read (camelCase keys like `averageScore`, `seasonYear`). Every persisted field in `backend/go-fetcher/internal/models/media.go` needs an explicit `bson` tag — mongo-driver v2 lowercases Go field names by default. If you change schemas in `backend/app/schemas/` or `media.go`, sync both sides and run `go test ./...` (`TestBSONTagsMatchPythonContract` guards this).

## Deploy

Push to `master` auto-deploys: `backend/**` → Docker Hub (`ray8118/anime-recommendations`) → Render hook; `frontend/**` → Bun build → Cloudflare Pages (`nekorec`). No test/lint gate in CI, so run checks locally first.
