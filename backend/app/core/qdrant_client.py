"""Build the shared Qdrant REST client without idle keepalive sockets."""

import httpx
from qdrant_client import QdrantClient


def build_qdrant_client(url: str | None, api_key: str | None) -> QdrantClient:
    """REST-only client that closes sockets after each request.

    Railway puts a service to sleep after ~10 minutes with no outbound
    traffic. Pooled Qdrant connections emit TCP keepalives every few minutes,
    which restarts that timer. gRPC channels do the same, so REST is explicit.
    """
    return QdrantClient(
        url=url,
        api_key=api_key,
        prefer_grpc=False,
        limits=httpx.Limits(max_keepalive_connections=0),
    )
