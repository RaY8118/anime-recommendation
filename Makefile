.DEFAULT_GOAL := help

# Directories
BACKEND     := backend
FETCHER     := $(BACKEND)/go-fetcher
PROTO_DIR   := $(BACKEND)/app/proto

# buf breaking target: the commit the proto must not break against.
# HEAD~1 = "the previous commit"; this is the drift check we run manually today.
BUF_AGAINST := ".git#commit=$(shell git rev-parse HEAD~1),subdir=$(PROTO_DIR)"

.PHONY: help
help: ## List available targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

.PHONY: proto
proto: ## Regenerate Go + Python stubs from the proto contract, then lint
	buf generate && buf lint

.PHONY: buf-breaking
buf-breaking: ## Check the proto didn't break wire-compat vs HEAD~1
	buf breaking --against $(BUF_AGAINST)

.PHONY: go-test
go-test: ## Run Go fetcher tests + vet
	cd $(FETCHER) && go test ./... && go vet ./...

.PHONY: go-run
go-run: ## Run the fetcher (needs the gRPC ingest server on 50051)
	cd $(FETCHER) && go run ./cmd/fetcher

.PHONY: python-api
python-api: ## Run the FastAPI REST server (port 8000)
	cd $(BACKEND) && uvicorn app.main:app --reload

.PHONY: python-grpc
python-grpc: ## Run the gRPC ingest server (port 50051)
	cd $(BACKEND) && PYTHONPATH=app/grpc_stub uv run python -m app.grpc_server.server

.PHONY: fe-build
fe-build: ## Frontend: lint + production build (tsc -b && vite build)
	cd frontend && bun run lint && bun run build

.PHONY: fe-run
fe-run: ## Frontend: run
	cd frontend && bun run dev
