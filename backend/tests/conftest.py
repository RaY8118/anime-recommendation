"""Shared setup for the backend smoke tests (no live services required)."""

import os
import sys
from pathlib import Path
from types import ModuleType

BACKEND_DIR = Path(__file__).resolve().parents[1]
GRPC_STUB_DIR = BACKEND_DIR / "app" / "grpc_stub"

# pytest runs as a console script, so neither the backend dir nor the
# generated protobuf stubs (committed outside the app package) are on sys.path.
for path in (GRPC_STUB_DIR, BACKEND_DIR):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

# Settings requires this at import time. Mongo clients are lazy, so no
# connection is made by these tests.
os.environ.setdefault("MONGODB_URI", "mongodb://localhost:27017")

# Importing app.core.qdrant opens a Qdrant connection, creates collections and
# indexes, and calls the embedding API. CI has no Qdrant/OpenRouter config, so
# stub those modules *before* any test imports app.main or the gRPC modules.
import app.core  # noqa: E402


def _stub(name: str, **attributes: object) -> None:
    module = ModuleType(name)
    for key, value in attributes.items():
        setattr(module, key, value)
    sys.modules[name] = module
    setattr(app.core, name.rsplit(".", 1)[-1], module)


_stub("app.core.embeddings", embeddings=object())
_stub(
    "app.core.qdrant",
    client=object(),
    embeddings=object(),
    vector_db=object(),
    COLLECTION_NAME="anime",
    BATCH_SIZE=200,
)
