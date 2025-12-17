
# Project Overview

This is a full-stack web application for anime recommendations. The backend is built with Python and FastAPI, and the frontend is a React application written in TypeScript.

## Technologies Used

### Backend

- Python
- FastAPI
- MongoDB
- Gemini for embeddings and chatbot

### Frontend

- React
- TypeScript
- Vite
- Tanstack Query
- Tailwind CSS

## API Endpoints

The backend exposes the following endpoints under the `/v1/animes` prefix:

- `POST /fetch`: Fetches and stores anime from an external API.
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

## Data Fetching

The `backend/app/utils/anime_api.py` file is responsible for fetching data from the AniList GraphQL API. The `get_anime` function fetches a paginated list of anime, processes them, generates embeddings for the descriptions, and stores them in the database. The `get_anime_by_name` function fetches a single anime by its name.

## Chatbot

The `backend/app/utils/chatbot.py` file implements the chatbot functionality. It uses the Gemini API to generate responses. The `chatbot` function takes a user's message, generates an embedding for it, and then uses a vector search to find similar anime in the database. The results are then formatted and sent to the Gemini model along with a system prompt to generate a response.

## Building and Running

### Backend

To run the backend server:

```bash
cd backend
uvicorn app.main:app --reload
```

### Frontend

To run the frontend development server:

```bash
cd frontend
npm run dev
```

## Development Conventions

The project uses `uv` for Python package management and `npm` or `bun` for the frontend. The backend follows standard FastAPI project structure, and the frontend is a typical Vite-based React application.
