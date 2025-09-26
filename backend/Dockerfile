# Stage 1: builder
FROM debian:bookworm-slim AS builder

RUN apt-get update && apt-get install -y ca-certificates bash curl \
  && rm -rf /var/lib/apt/lists/*

# Copy uv binary
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Install dependencies into .venv
COPY pyproject.toml uv.lock ./
RUN uv sync --locked

# Copy source (we need it for packaging dependencies correctly)
COPY ./app /app/app

# Stage 2: runtime
FROM gcr.io/distroless/base

WORKDIR /app

# Copy uv binary
COPY --from=builder /usr/local/bin/uv /usr/local/bin/uv

# Copy only the environment + source code
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/app /app/app

EXPOSE 8000
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
