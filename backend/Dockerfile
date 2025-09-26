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
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
