"""HTTP clients must not leave idle keepalive sockets behind."""

import httpx

import app.core.qdrant_client as qdrant_client_module


def test_qdrant_client_uses_rest_without_keepalive(monkeypatch):
    captured: dict = {}

    class FakeQdrantClient:
        def __init__(self, **kwargs):
            captured.update(kwargs)

    monkeypatch.setattr(qdrant_client_module, "QdrantClient", FakeQdrantClient)

    result = qdrant_client_module.build_qdrant_client(
        "https://example.cloud.qdrant.io", "secret"
    )

    assert isinstance(result, FakeQdrantClient)
    assert captured["url"] == "https://example.cloud.qdrant.io"
    assert captured["api_key"] == "secret"
    assert captured["prefer_grpc"] is False
    assert isinstance(captured["limits"], httpx.Limits)
    assert captured["limits"].max_keepalive_connections == 0
