"""Thin gRPC layer: decode proto → service → IngestSummary. No business logic here."""

import logging

from anime.v1 import ingest_pb2, ingest_pb2_grpc

from app.grpc_server import mapping, service

logger = logging.getLogger(__name__)


class IngestService(ingest_pb2_grpc.IngestServiceServicer):
    async def IngestAnimes(self, request_iterator, context):
        decode_failures: list[str] = []

        async def decoded():
            async for request in request_iterator:
                try:
                    yield mapping.anime_request_to_document(request)
                except Exception as exc:
                    decode_failures.append(f"id={request.id}: (decode) {exc}")

        result = await service.ingest_stream(decoded())

        failed = result.failed + len(decode_failures)
        message = "Ingest complete"
        if failed:
            message = f"{failed} anime failed: " + "; ".join(
                (result.errors + decode_failures)[:5]
            )
        logger.info(
            "ingest stream: received=%d inserted=%d embedded=%d failed=%d",
            result.received,
            result.inserted,
            result.embedded,
            failed,
        )
        return ingest_pb2.IngestSummary(
            received=result.received,
            ids=result.ids,
            inserted=result.inserted,
            embedded=result.embedded,
            failed=failed,
            message=message,
            upserted=result.upserted,
            matched=result.matched,
            modified=result.modified,
        )
