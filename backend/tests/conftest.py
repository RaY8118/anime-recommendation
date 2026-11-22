"""Shared setup for the backend smoke tests (no live services required)."""

import os
import sys
from pathlib import Path

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
