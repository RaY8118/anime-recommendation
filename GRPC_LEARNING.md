# gRPC Learning Track — Go → Python anime ingest

Progress file for adding gRPC to this repo one step at a time.
**Rule: assistant guides, you write all code.** Update the "Status" block below at the end of every session.

---

## Status

- **Current stage: Stage 3 COMPLETE ✅ → Stage 4 planning next**
- Stage 1 (single anime Go → Python):**done** (wire proven both directions; `HasField`/pointers/proto.String lessons banked).
- Stage 2 (client streaming):**done** (`IngestAnimes(stream) → IngestSummary`; send-loop + `CloseAndRecv` mechanics learned).
- Stage 3 (real pipeline in Python servicer):**done.** Final layout: `app/grpc_server/{mapping,service,servicer,server}.py`; `grpc.aio` server on `settings.grpc_port`; end-of-stream embed flush via `asyncio.to_thread`; dev DB via `MONGODB_URI` path redirect. **Verified end-to-end through the real recommendation endpoint** (`GET /v1/animes/recommendations` returned gRPC-ingested anime). Lessons banked: `get_database()` is an async FastAPI dependency — services should use `get_mongo_client().get_database(DB_NAME)`; `logging.basicConfig` once at entrypoint (bare `print` gone for good); pydantic silently drops unknown keys — schema had to gain `chapters/volumes/popularity` (additive); `embedding` default-`[]` artifact popped before write to match Go-shaped docs; proto gained appended `is_adult=17` + summary counters (inserted/embedded/failed).
- Stage 4 (remove Mongo from go-fetcher, buf breaking-check as contract guard, retire legacy /fetch):**not started — plan before code**
- Stage 5 (hardening: deadlines, retries, bufconn tests, docs/AGENTS.md update, graceful shutdown):not started
- Stage 3 (real pipeline in Python servicer: clean → Mongo → embed):not started
- Stage 4 (remove Mongo from go-fetcher, buf breaking-check as contract guard):not started
- Stage 5 (hardening: deadlines, retries, bufconn tests, docs/AGENTS.md update):not started
- Stage 3 (real pipeline in Python servicer: clean → Mongo → embed):not started
- Stage 4 (remove Mongo from go-fetcher, buf breaking-check as contract guard):not started
- Stage 5 (hardening: deadlines, retries, bufconn tests, docs/AGENTS.md update):not started

---

## Big picture (why each stage exists)

Final architecture: go-fetcher's fetch loop sends anime → Python gRPC server (`app/grpc_server/`) → existing Python pipeline (clean, validate, insert into Mongo, generate embeddings into Qdrant). The `.proto` file becomes the single cross-language contract, replacing the implicit BSON one.

- **Stage 1** proves the pipe: one anime, one call, no streaming, no Mongo, no Qdrant.
- **Stage 2** turns the call into a client stream (the real shape of bulk ingest).
- **Stage 3** makes the Python side do actual work with its existing services layer.
- **Stage 4** deletes the Go Mongo writer; go-fetcher becomes purely `AniList → gRPC`.
- **Stage 5** production polish + docs.

---

## Stage 0 — Toolchain prerequisites

1. Install buf: `curl -sSL https://buf.build/install.sh | bash` (then `buf --version` on PATH).
2. Install Go plugins:
   - `go install google.golang.org/protobuf/cmd/protoc-gen-go@latest`
   - `go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest`
   - Ensure `$HOME/go/bin` is on PATH (both must run from a plain shell).
3. Add Python deps (repo-standard way, never pip):
   - `cd backend && uv add grpcio grpcio-tools && uv sync --locked`-equivalent (check the command output; commit `pyproject.toml` + `uv.lock`).
4. Decide Python codegen output dir: recommend `backend/app/grpc_stub/` (or `app/proto_gen/`) — stay consistent once decided.

**Checkpoint:** `buf --version`, `protoc-gen-go --version`, `protoc-gen-go-grpc --version`, and `uv run python -c "import grpc; print(grpc.__version__)"` all succeed.

---

## Stage 1 — Pass ONE anime from Go to Python (current goal)

Goal: standalone, nothing wired into the app yet. Prove end-to-end: Go sends one hardcoded anime over gRPC; Python prints it.

### 1a. Create the proto

1. Create `proto/anime/v1/ingest.proto` (top-level `proto/` keeps it independent of backend/go-fetcher).
2. Package naming: `anime.v1`. Files: `syntax = "proto3";`
3. Messages:
   - `AnimeDocument` — for Stage 1 only the title you need is enough, but define the shape now so Stage 3 doesn't rename things: id, title_romaji, title_english, description, genres (repeated string), average_score … (look at `backend/go-fetcher/internal/models/media.go` field names as your source of truth; proto-style naming will be romanized_snake_case).
   - Keep it minimal-but-forward-compatible: do NOT add bson tags/mongo concerns in the proto. Proto naming is the contract from now on.
4. Service:
   - `service IngestService { rpc IngestAnime(AnimeDocument) returns (IngestAck); }`
   - `IngestAck { string message = 1; }` — enough to prove round-trip.
   - (Streaming RPC comes in Stage 2; keep this unary for now even though final service will be `stream` — that's the lesson-ordered path.)

### 1b. buf config + codegen

1. Create `buf.yaml` at repo root with reasonable lint rules (DEFAULT is fine).
2. Create `buf.gen.yaml` with two output plugins:
   - Go → `backend/go-fetcher/gen/anime/v1` (or a module-local `gen/` dir)
   - Python → the dir from Stage 0.4
3. Run `buf generate`, then `buf lint` and fix complaints (lint catching things is itself useful learning).

**Checkpoint:** generated `.pb.go` + `*_grpc.pb.go` in go-fetcher; generated `*_pb2.py` / `*_pb2_grpc.py` on the Python side. Commit generated dirs (pragmatic for now; revisit in Stage 5 with a codegen gate).

### 1c. Minimal Python server (throwaway initial version)

Path suggestion: `backend/app/grpc_server/server.py` (won't be the final file layout — Stage 3 restructures it).

Behavior:
- Import the generated `*_pb2_grpc.py` servicer stub.
- Implement `IngestAnime(self, request, context)` → return an `IngestAck` and print/inspect the received fields (this is the acceptance test for Stage 1).
- Bind to `[::]:50051` (port choice arbitrary; avoid 8000).
- Run with a plain `grpc.server(...)` + `add_insecure_port`, no TLS, no auth, no validation — all of that is deliberate Stage 5 material.
- Run it from `backend/` so `.env`/package resolution behaves like uvicorn does, but don't touch `MONGODB_URI` logic yet — Stage 1 shouldn't need Mongo at all.

Command shape: `cd backend && uv run python -m app.grpc_server.server`

**Checkpoint:** server starts, prints "listening", no import errors from generated code.

### 1d. Minimal Go client (throwaway initial version)

Path suggestion: `backend/go-fetcher/cmd/grpcplay/` — a tiny throwaway main, separated from the real fetcher (`cmd/fetcher/`) on purpose so Stage 1 cannot break production ingest behavior.

Behavior:
- Dial `localhost:50051` insecurely with a real `NewIngestServiceClient(...)` (even though server is in Python — the whole point is cross-language).
- Build ONE hardcoded `AnimeDocument` (e.g. FMA:B, id 5114, one genre) and call the RPC.
- Print the ack.

Command shape: `cd backend/go-fetcher && go run ./cmd/grpcplay`

**Checkpoint (Stage 1 complete):** Python server logs the Go-constructed anime verbatim; ack appears in the Go client's output. `buf lint` clean, `go vet ./...` clean.

### Notes / gotchas for this stage

- When proto naming and Go struct naming diverge (e.g. `average_score` vs `averageScore`), that mapping is now enforced by the generator, not by hand-maintained tags — that's exactly the silent-drift bug this project already had, so notice what disappears.
- Proto comments are documentation; put one comment above each field saying what it means in the AniList/Mongo world — future you will thank you in Stage 4.
- Don't add `context.Context` timeouts/deadlines yet — knowing *why* you need them later is part of the learning.
- Keep Stage 1 disposable: if it would be painful to rewrite in Stage 2 (streaming), that's fine — the delta between unary and client-streaming `stream AnimeDocument (...) returns (IngestSummary)` is your first real streaming lesson.

---

## Stage 2 — Client streaming (concrete steps, starting here)

Goal: one RPC, many anime. Change the *evolve in place* — the unary RPC is throwaway now.

### 2a. Proto change + regen
1. In `ingest.proto`, replace the unary RPC with a client-streaming one:
   - `rpc IngestAnimes(stream IngestAnimeRequest) returns (IngestSummary);`
   - Add `IngestSummary { int32 received = 1; repeated int32 ids = 2; string message = 3; }`
   - Delete `IngestAnime` unary + `IngestAnimeResponse` (only consumer is the throwaway client).
2. `buf generate && buf lint` from repo root; confirm new Go type `pb.IngestService_IngestAnimesClient` exists (grep `gen/anime/v1/ingest_grpc.pb.go`).

### 2b. Python servicer
- Recreate the servicer method as `IngestAnimes(self, request_iterator, context)`.
- Loop: `for r in request_iterator:` — print each anime (reuse Stage 1's prints, ideally as an intotal helper function), collect ids, then `return IngestSummary(received=len(ids), ids=ids, message=...)`.
- Lesson notes: `request_iterator` is a plain Python iterable that blocks per frame; nothing to call to "finish" receiving — returning from the method is what signals the end server-side.

### 2c. Go client (`cmd/grpcplay`)
- Pattern: `stream, err := client.IngestAnimes(ctx)` → build 3 requests (FMA:B, Death Note id 1535, Steins;Gate id 32281 — any fields) → `for _, r := range reqs { if err := stream.Send(r); err != nil { ... } }` → `summary, err := stream.CloseAndRecv()`.
- Lessons: `Send` only queues (no wire guarantee per call), `CloseAndRecv` is the flush+finish; errors mid-stream vs at-end; what `io.EOF` means server-side (`request_iterator` ends) vs Go (`CloseAndRecv` returns).
- Checkpoint: Python prints all 3, Go prints `received=3`.

### After Stage 2 passes
Run `buf lint` keeping STANDARD clean → then Stage 3 begins: Python servicer stops printing and starts doing real work (see sketch in original plan below).

---

## Stage 3 — Real pipeline on the Python side (sketch)

- `app/grpc_server/` grows into a proper servicer reusing: `app.core.text.clean_html` → `app.schemas.animes` validation → Mongo upsert (idempotent semantics currently in go-fetcher's `internal/database`) → `app.core.embeddings` into Qdrant.
- Same-container dev story: uvicorn (8000) + gRPC (50051), separate processes.
- The "run go-fetcher then curl generate-embeddings" two-step disappears — embeddings happen inline during ingest.
- Lesson focus: servicer ↔ service-layer boundary, where validation belongs, mock seams for testing without Mongo/Qdrant.

---

## Stage 4 — Remove Mongo from Go (sketch)

- Delete `internal/database/`, mongo-driver, `internal/models/` bson-sync test; replace with buf **breaking-change** check as the contract guard (`TestBSONTagsMatchPythonContract`'s replacement).
- go-fetcher config swap (Mongo URI → gRPC address in `backend/.env`, keeping the `.env` fallback loading pattern).
- Update docs: `AGENTS.md` BSON-contract section → proto/buf section, `backend/go-fetcher/README.md`, `backend/README.md`.

---

## Stage 5 — Hardening (sketch)

- Deadlines/cancellation from Go, retry/interceptor on both sides, graceful shutdown for the gRPC server.
- bufconn-based Go integration tests; fake-stream unit tests for the Python servicer.
- Decide prod rollout: gRPC server enabled in the backend Docker image (entrypoint runs uvicorn + grpc server) or keep it localhost-only initially.
- Final docs pass: `AGENTS.md`, backend README structure tree, this file archived or trimmed.
