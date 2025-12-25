# Backend Overview

This is the backend for the NekoRec anime recommendation system. It is a Python-based application built with the FastAPI framework.

## Key Technologies

- **Python:** The core programming language.
- **FastAPI:** A modern, high-performance web framework for building APIs.
- **MongoDB:** The primary database for storing anime data, user information, and other application-related data.
- **Uvicorn:** A lightning-fast ASGI server for running the FastAPI application.
- **Pydantic:** Used for data validation and settings management.
- **Gemini:** The Gemini API is used for generating embeddings.
- **OpenRouter:** The OpenRouter API is used for the multi-model chatbot functionality.

## Project Structure

- `app/`: The main application directory.
  - `routers/`: Contains the API endpoints for different resources (e.g., `animes`, `watchlist`).
  - `schemas/`: Defines the Pydantic models for data validation and serialization.
  - `utils/`: Includes utility functions for tasks such as interacting with the AniList API, generating embeddings, and managing the chatbot.
  - `dependencies.py`: Contains dependency injection functions, such as for getting a database connection.
  - `main.py`: The entry point of the FastAPI application.
- `fetch_anime.py`: A script for fetching anime data from the AniList API and populating the database.
- `pyproject.toml`: The project's dependency and metadata configuration file.

## Running the Application

To run the backend server for development, use the following command:

```bash
uvicorn app.main:app --reload
```

This will start the server on `http://127.0.0.1:8000`, and it will automatically reload when code changes are detected.
