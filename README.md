# ✨ NekoRec: Anime Recommendation System

NekoRec is a full-stack web application designed to provide personalized anime recommendations. Users can browse anime, view details, explore by genre, and receive recommendations based on content similarity.

## 🚀 Features

- 📚 **Browse Anime:** Explore a wide collection of anime.
- 🎬 **Anime Details:** View detailed information about each anime, including synopsis, genres, and more.
- 🏷️ **Genre Exploration:** Filter and discover anime by various genres.
- ❤️ **Personalized Recommendations:** Get anime recommendations based on content similarity (e.g., description, genres).
- 💡 **Suggest Anime:** Functionality for users to suggest new anime

## 🛠️ Technologies Used

### 🐍 Backend

- **Python:** The core programming language.
- **FastAPI:** A modern, fast (high-performance) web framework for building APIs with Python 3.7+.
- **uv:** A fast Python package installer and resolver.
- **Gemini Embeddings:** Used for generating vector embeddings of anime descriptions for content-based recommendations.
- **MongoDB:** NoSQL database used for storing anime data and embeddings.
- **Data Processing:** Custom scripts for fetching anime data, text cleaning, generating embeddings, and calculating similarity for recommendations.

### 🌐 Frontend

- **React:** A JavaScript library for building user interfaces.
- **TypeScript:** A typed superset of JavaScript that compiles to plain JavaScript.
- **Vite:** A fast build tool that provides a lightning-fast development experience.
- **Tanstack Query:** For efficient data fetching, caching, and state management.
- **Tailwind CSS:** A utility-first CSS framework for rapidly building custom designs.
- **ESLint:** For code linting and maintaining code quality.

## 🏁 Getting Started

Follow these instructions to set up and run the project locally.

### 📋 Prerequisites

- **Python 3.9+** (or the version specified in `.python-version` in the `backend` directory)
- **Node.js** (LTS version recommended) or **Bun** (if using `bun.lock`)
- **Git**

### ⚙️ Backend Setup

1.  Navigate to the `backend` directory:
    ```bash
    cd backend
    ```
2.  Install `uv` (if you don't have it):
    ```bash
    pip install uv
    ```
3.  Create a virtual environment and install dependencies using `uv`:
    ```bash
    uv venv
    source .venv/bin/activate  # On Windows: .venv\Scripts\activate
    uv pip install -r requirements.txt # Or uv pip install -e . if pyproject.toml is configured for editable install
    ```
    _Note: If `requirements.txt` is not present, `uv.lock` is used. You might need to run `uv pip install` directly or `uv sync`._
4.  Run the FastAPI application:
    ```bash
    uvicorn app.main:app --reload
    ```
    The backend API will be available at `http://127.0.0.1:8000` (or similar).

### 🖥️ Frontend Setup

1.  Navigate to the `frontend` directory:
    ```bash
    cd frontend
    ```
2.  Install dependencies using npm, yarn, or bun:
    ```bash
    npm install
    # or yarn install
    # or bun install
    ```
3.  Start the development server:
    ```bash
    npm run dev
    # or yarn dev
    # or bun dev
    ```
    The frontend application will be available at `http://localhost:5173` (or similar).

## 📂 Project Structure

```
.
├── .gitignore
├── backend/                  # FastAPI backend application
│   ├── app/                  # Main FastAPI application code
│   │   ├── routers/          # API endpoints (e.g., animes)
│   │   ├── schemas/          # Pydantic models for data validation
│   │   └── utils/            # Utility functions (embeddings, similarity, data fetching)
│   ├── fetch_anime.py        # Script for fetching and processing anime data
│   ├── Dockerfile            # Docker configuration for the backend
│   └── pyproject.toml        # Project configuration and dependencies (Poetry/Rye)
├── frontend/                 # React/TypeScript frontend application
│   ├── public/               # Static assets
│   ├── src/                  # Frontend source code
│   │   ├── components/       # Reusable React components
│   │   ├── pages/            # Main application pages/views
│   │   ├── services/         # API service integrations
│   │   └── types/            # TypeScript type definitions
│   ├── package.json          # Frontend dependencies and scripts
│   ├── tailwind.config.js    # Tailwind CSS configuration
│   └── vite.config.ts        # Vite build configuration
└── README.md                 # This project README file
```

## 🚀 Deployment

### Backend

The backend is deployed as a Docker image on Docker.

### Frontend

The frontend is deployed on Cloudflare Pages.

## 🤝 Contributing

Contributions are welcome! Please feel free to open issues or submit pull requests.
