# Frontend (React + Vite + TypeScript)

React/Vite frontend for NekoRec. It uses Auth0 for authentication, TanStack Query for data fetching/caching, Tailwind CSS v4 for styling, and communicates with the FastAPI backend via Axios under `/v1/*`.

## Tech Stack

- **React 19 + TypeScript**
- **Vite 7** (`@vitejs/plugin-react`, HMR)
- **Tailwind CSS v4** (`@tailwindcss/vite` plugin)
- **TanStack Query v5** — server state, caching, mutations
- **React Router v7** — client-side routing
- **Auth0 React SDK v2** (`@auth0/auth0-react`) — PKCE, localStorage cache, refresh tokens
- **Axios** — HTTP client
- **Framer Motion, React Icons, React Markdown** — UI/UX
- **ESLint 9** (flat config) + TypeScript ESLint + React Hooks rules

## Scripts

```bash
npm run dev      # Start Vite dev server
npm run build    # tsc -b && vite build
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

(Bun is also supported; both `package-lock.json` and `bun.lock` are present.)

## Project Structure

```text
frontend/
├── index.html
├── vite.config.ts         # React + Tailwind v4 plugin; vendor chunk splitting
├── tailwind.config.js     # Dark mode (class), custom keyframes/animations
├── eslint.config.js       # Flat config (TS/TSX, react-hooks, react-refresh)
├── tsconfig.json          # References app/node configs
├── tsconfig.app.json      # ES2022, strict, jsx: react-jsx
├── tsconfig.node.json     # For vite.config.ts
├── public/favicon.png
├── src/
│   ├── main.tsx           # QueryClientProvider + Auth0Provider
│   ├── App.tsx            # Routes, health check (pingServer), global ChatbotUi
│   ├── App.css
│   ├── index.css
│   ├── vite-env.d.ts      # Vite client types
│   ├── assets/favicon.png
│   ├── components/
│   │   ├── AnimeCard.tsx
│   │   ├── AnimeFilter.tsx
│   │   ├── Chatbot.tsx
│   │   ├── Error.tsx
│   │   ├── Footer.tsx
│   │   ├── GenreHighlights.tsx
│   │   ├── Loader.tsx
│   │   ├── Navbar.tsx
│   │   ├── ThemeToggle.tsx
│   │   └── TopRatedList.tsx
│   ├── pages/
│   │   ├── AnimeDetails.tsx
│   │   ├── Browse.tsx
│   │   ├── Genres.tsx
│   │   ├── Home.tsx
│   │   ├── Recommendations.tsx
│   │   ├── SuggestAnime.tsx
│   │   └── Watchlist.tsx
│   ├── hooks/
│   │   ├── newDebounce.ts
│   │   └── useMediaQuery.ts
│   ├── services/
│   │   └── api.ts          # Centralized Axios client for /v1/* endpoints
│   └── types/
│       ├── anime.ts
│       └── watchlist.ts
```

## Routes

`App.tsx` defines routes: `/`, `/browse`, `/anime/:id`, `/recommendations`, `/genres`, `/suggest`, `/watchlist`. The app first pings the backend (`pingServer()`) to gate initial render; `ChatbotUi` renders globally.

## API Layer

`src/services/api.ts` creates an Axios instance with base URL `${import.meta.env.VITE_API_URL}/v1`. Exports: `pingServer`, `pingPrivateServer`, `getAllAnimes`, `getAnimeById`, `getRecommendations`, `getGenres`, `filterByGenre`, `searchAnime`, `suggestAnime`, `getRandomAnime`, `getTopRated`, `getChatbotModels`, `sendChatMessage`, `getWatchlist`, `addToWatchlist`, `getWatchlistItem`, `deleteFromWatchlist`, `updateWatchlistStatus`.

## Auth0 Configuration

`src/main.tsx` wraps the app with `Auth0Provider` using:

- `domain`, `clientId`, `authorizationParams.audience` from `VITE_AUTH0_*`
- `authorizationParams.scope = "openid profile email read:messages"`
- `cacheLocation = "localstorage"`
- `useRefreshTokens = true`

Protected pages/hooks use `useAuth0()` to attach access tokens to watchlist/chat requests as needed.

## Environment Variables

Create `frontend/.env` (gitignored):

| Variable | Required | Example |
| --- | --- | --- |
| `VITE_API_URL` | Yes | `http://localhost:8000` or production backend URL |
| `VITE_AUTH0_DOMAIN` | Yes | `your-tenant.auth0.com` |
| `VITE_AUTH0_CLIENT_ID` | Yes | SPA client ID |
| `VITE_AUTH0_AUDIENCE` | Yes | Auth0 API audience (must match backend) |

All are consumed via `import.meta.env`.

## Build & Config Notes

- **Vite**: `@tailwindcss/vite` plugin is used (Tailwind v4). `manualChunks` splits `react`, `react-dom`, `@headlessui/react` into a vendor chunk.
- **Tailwind**: `darkMode: 'class'`, content includes `index.html` and `src/**/*.{js,ts,jsx,tsx}`.
- **ESLint**: Flat config with recommended TS rules, `eslint-plugin-react-hooks`, and `eslint-plugin-react-refresh` (Vite-specific).
- **TypeScript**: Strict mode enabled. Project references split app and node (vite config) types.
- **No test suite** is configured (no `test` script, no Vitest/Jest, no spec files).