FROM python:3.12-slim

# Copy uv binary
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Copy app and dependency files
COPY pyproject.toml uv.lock ./
COPY ./app /app/app

# Install dependencies into uv environment
RUN uv sync --locked

# Expose port
EXPOSE 8000

# Run using uv binary
CMD [  "uv",  "run",  "gunicorn",  "app.main:app",  "-k", "uvicorn.workers.UvicornWorker",  "--workers", "2",  "--bind", "0.0.0.0:8000",  "--timeout", "60",  "--access-logfile", "-"]
