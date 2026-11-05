"""gRPC ingest server bootstrap (aio). Run from backend/:

PYTHONPATH=app/grpc_stub uv run python -m app.grpc_server.server
"""

import asyncio
import logging

import grpc
from anime.v1 import ingest_pb2_grpc

from app.core.config import get_settings
from app.grpc_server.servicer import IngestService


async def serve() -> None:
    settings = get_settings()
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    server = grpc.aio.server()

    ingest_pb2_grpc.add_IngestServiceServicer_to_server(IngestService(), server)

    address = f"[::]:{settings.grpc_port}"
    if server.add_insecure_port(address) == 0:
        raise RuntimeError(f"could not bind gRPC server to {address}")

    await server.start()
    logging.getLogger(__name__).info("gRPC ingest server listening on %s", address)

    await server.wait_for_termination()


if __name__ == "__main__":
    asyncio.run(serve())
