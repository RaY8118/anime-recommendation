# ✨ NekoRec: Anime Recommendation System

NekoRec is a full-stack anime recommendation web app. It lets users browse anime, view details, filter by genre, get content-based recommendations, manage a watchlist (with Auth0), and chat with a multi-model AI assistant.

## 🚀 Features

- 📚 **Browse Anime** — Explore a large collection of anime pulled from AniList.
- 🎬 **Anime Details** — View synopsis, genres, season/year, average score, and more.
- 🏷️ **Genre Exploration** — Discover and filter anime by genre.
- ❤️ **Content-Based Recommendations** — Get similar anime using vector embeddings of descriptions + metadata.
- 💡 **Suggest Anime** — Submit anime suggestions via the API.
- 💬 **AI Chatbot** — Multi-model assistant powered by OpenRouter (LangChain).
- 👤 **Watchlist** — Auth0-protected watchlist with add/view/update/delete/status.
- 🧠 **Vector Search** — Embeddings generated from cleaned anime descriptions for similarity scoring.

## 🛠️ Tech Stack

### Backend (FastAPI)

- **Python 3.12.3** — Core language (pinned in `pyproject.toml`).
- **FastAPI** — High-performance async web framework.
- **Uvicorn + Gunicorn** — ASGI server (production Docker image uses Gunicorn with Uvicorn workers).
- **uv** — Fast Python package/lockfile manager (`uv.lock`).
- **LangChain + LangChain-OpenRouter** — Multi-model chatbot orchestration.
- **MongoDB (motor/pymongo)** — Stores anime metadata (`new_animes`) and embeddings (`embeddings`).
- **Auth0 (authlib)** — JWT validation for protected routes (watchlist, ping-private).
- **OpenRouter** — Used for embeddings (`google/gemini-embedding-001`) and LLM chat models.
- **AniList GraphQL API** — Source of truth for anime metadata.

### Data Ingestion (Go)

- **Go 1.27.0** — Standalone fetcher binary at `backend/go-fetcher/` that ingests AniList IDs into MongoDB (idempotent upserts). See its README for details.

### Frontend (React + Vite)

- **React 19 + TypeScript** — UI framework.
- **Vite 7** — Build/dev server (HMR).
- **TanStack Query v5** — Data fetching, caching, and mutations.
- **Tailwind CSS v4** — Utility-first styling (`@tailwindcss/vite`).
- **React Router v7** — Client-side routing.
- **Auth0 React SDK** — Authentication (PKCE, refresh tokens).
- **Axios** — HTTP client for backend API.
- **Framer Motion, React Icons, React Markdown** — UI polish and markdown rendering.

## 🏗️ Architecture & Data Flow

1. **Ingest**: `backend/go-fetcher` walks AniList IDs and upserts documents into MongoDB collection `new_animes` (database `anime_recommendation`). Documents use explicit BSON tags (`averageScore`, `seasonYear`) shared with the Python contract (validated by Go tests).
2. **Embed**: Run embedding generation (e.g. `backend/app/utils/anime_embedding_generation.py`) to build vector embeddings from cleaned descriptions and populate the `embeddings` collection.
3. **Serve**: FastAPI (`app.main:app`) exposes REST API under `/v1/*` (animes, chatbot, watchlist, ping). Recommendations use cosine similarity over stored embeddings.
4. **UI**: React app calls the backend via Axios (`src/services/api.ts`) and uses Auth0 for authenticated watchlist actions.

## 🚦 Quick Start

### Prerequisites

- **Python 3.12.3** (matches `pyproject.toml`; use a version manager like `pyenv` if needed)
- **Node.js LTS** or **Bun** (frontend lockfiles include both `package-lock.json` and `bun.lock`)
- **Go 1.27+** (to run the fetcher)
- **MongoDB** instance (Atlas or local)
- API keys: **OpenRouter API key**, **Auth0** tenant (domain, client ID, API audience)

### 1) Backend Setup

```bash
cd backend

# Install uv if not present
pip install uv

# Create venv and install deps (from uv.lock)
uv venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
uv sync --locked
```

Create `backend/.env` (gitignored). See [Environment Variables](#-environment-variables) below.

Run the API (dev):

```bash
uvicorn app.main:app --reload
# API at http://127.0.0.1:8000 (docs at /docs)
```

Production (Docker): image runs Gunicorn with Uvicorn workers on `${PORT:-8000}`.

### 2) Frontend Setup

```bash
cd frontend
npm install  # or bun install
npm run dev  # or bun dev
# App at http://localhost:5173
```

Build for production:

```bash
npm run build  # runs tsc -b && vite build
npm run preview
```

### 3) Data Ingestion (Go Fetcher)

Populate `new_animes` from AniList:

```bash
cd backend/go-fetcher
go run ./cmd/fetcher
```

Then generate embeddings (Python):

```bash
cd backend
source .venv/bin/activate
python app/utils/anime_embedding_generation.py
```

## 🔐 Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `MONGODB_URI` | Yes | — | MongoDB connection string |
| `AUTH0_DOMAIN` | Yes (auth-protected routes) | — | e.g. `your-tenant.auth0.com` |
| `AUTH0_API_AUDIENCE` | Yes | — | Auth0 API identifier/audience |
| `OPENROUTER_API_KEY` | Yes | — | Used for Gemini embeddings + LLM chat |
| `ALLOWED_ORIGINS` | No | `*` | Comma-separated CORS origins |
| `ENV` | No | `DEVELOPMENT` | `DEVELOPMENT`/`PRODUCTION` affects CORS/logging behavior |

> Note: `GEMINI_API_KEY` may appear in local `.env`/CI but is not referenced by backend Python code; the app uses OpenRouter endpoints (e.g. `google/gemini-embedding-001`).

### Frontend (`frontend/.env`)

| Variable | Required | Notes |
| --- | --- | --- |
| `VITE_API_URL` | Yes | Backend base URL (e.g. `http://localhost:8000` or deployed URL) |
| `VITE_AUTH0_DOMAIN` | Yes | Auth0 domain |
| `VITE_AUTH0_CLIENT_ID` | Yes | Auth0 SPA client ID |
| `VITE_AUTH0_AUDIENCE` | Yes | Same audience as backend |

### Go Fetcher (env or `.env`)

The fetcher auto-loads `.env` from `./.env`, `../.env`, or `backend/.env`. See `backend/go-fetcher/README.md` for the full configuration table (`MONGODB_URI`, DB/collection, AniList batch/rate-limit settings, timeouts, retries).

## 📂 Project Structure

```text
.
├── README.md
├── GEMINI.md
├── .github/workflows/        # CI/CD (Docker Hub+Render, Cloudflare Pages, disabled GCP)
├── backend/
│   ├── Dockerfile            # Gunicorn+Uvicorn, uv-based build
│   ├── .dockerignore
│   ├── pyproject.toml        # Python deps + Python 3.12.3 pin
│   ├── uv.lock               # Locked deps
│   ├── fetch_anime.py        # Legacy helper (calls /animes/fetch without /v1)
│   ├── app/
│   │   ├── main.py           # FastAPI app, routers, CORS, middleware
│   │   ├── dependencies.py   # MongoDB clients, DB name
│   │   ├── routers/          # animes.py, ping.py, watchlist.py
│   │   ├── schemas/          # animes.py, watchlist.py (Pydantic)
│   │   └── utils/            # embeddings, chatbot/langbot, anime_api, clean_text, auth0_security, ...
│   └── go-fetcher/           # Go AniList → MongoDB ingestor (cmd/, internal/, go.mod)
└── frontend/
    ├── index.html
    ├── vite.config.ts         # React + @tailwindcss/vite, manual vendor chunks
    ├── tailwind.config.js     # Dark mode (class), custom animations
    ├── eslint.config.js       # Flat ESLint (TS + React hooks)
    ├── tsconfig*.json
    ├── package.json           # Scripts: dev/build/lint/preview (no tests)
    └── src/
        ├── main.tsx           # QueryClient + Auth0Provider
        ├── App.tsx            # Routes, health ping, global Chatbot
        ├── components/        # Navbar, AnimeCard, Chatbot, Loader, etc.
        ├── pages/             # Home, Browse, AnimeDetails, Recommendations, Genres, Suggest, Watchlist
        ├── hooks/             # useMediaQuery, newDebounce
        ├── services/api.ts    # Centralized axios calls to /v1/*
        └── types/             # anime.ts, watchlist.ts
```

## 🚀 Deployment

- **Backend**: Built as Docker image (`ray8118/anime-recommendations:latest`) via GitHub Actions (`deploy-backend.yml`) and deployed to **Render** using a deploy hook. A disabled GCP Cloud Run workflow exists as an alternative.
- **Frontend**: Built with Bun (`bun run build`) in CI (`deploy-frontend.yml`) and deployed to **Cloudflare Pages** (`project-name: nekorec`), outputting `frontend/dist/`.

## 🧪 Tests

- **Go**: Unit tests in `backend/go-fetcher` cover AniList client (retries/GraphQL errors), BSON contract against Python (`TestBSONTagsMatchPythonContract`), media transform/cleaning, and migrate rehearsal. Run with `go test ./...` and `go vet ./...` from `backend/go-fetcher/`.
- **Python/Frontend**: No test suites, configs, or scripts are present in this repo.

## 🤝 Contributing

Contributions welcome! Feel free to open issues or submit pull requests.