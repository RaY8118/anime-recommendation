"""Ingest business logic — no gRPC types in this module.

Takes a stream of already-decoded anime dicts, validates each through the
Anime schema, upserts into Mongo (replace-one on `id`, mirroring go-fetcher's
Store.Upsert), and flushes a single Qdrant embedding batch at end-of-stream.
"""

import asyncio
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass, field

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.deps import get_mongo_client
from app.core.qdrant import vector_db
from app.schemas.animes import Anime
from app.services.embeddings.generate import anime_to_document

logger = logging.getLogger(__name__)


@dataclass
class IngestResult:
    received: int = 0
    ids: list[int] = field(default_factory=list)
    inserted: int = 0
    embedded: int = 0
    failed: int = 0
    errors: list[str] = field(default_factory=list)


async def ingest_stream(documents: AsyncIterator[dict]) -> IngestResult:
    db = get_mongo_client().get_database("anime_recommendation_dev")
    result = IngestResult()
    collected: list[dict] = []

    async for document in documents:
        result.received += 1
        try:
            validated = Anime(**document).model_dump()
            validated.pop("embedding", None)

            await _upsert(db, validated)
            result.inserted += 1
            result.ids.append(validated["id"])
            collected.append(validated)
        except Exception as exc:
            result.failed += 1
            result.errors.append(f"id={document.get('id')}: {exc}")

    if collected:
        result.embedded = await _embed(collected, result)

    return result


async def _upsert(db: AsyncIOMotorDatabase, document: dict) -> None:
    """Replace-one upsert keyed on `id` — same idempotency as go-fetcher."""
    await db.new_animes.replace_one({"id": document["id"]}, document, upsert=True)


async def _embed(documents: list[dict], result: IngestResult) -> int:
    """End-of-stream flush: one Qdrant batch for everything validated.

    Uses anime_to_document so payload metadata matches exactly what
    anime_recommendations.py and chatbot/retrieval.py filter on.
    """
    batch_ids = [doc["id"] for doc in documents]
    batch = [anime_to_document(doc) for doc in documents]

    try:
        await asyncio.to_thread(vector_db.add_documents, documents=batch, ids=batch_ids)
        return len(batch)
    except Exception as exc:
        logger.exception("embedding flush failed")
        result.errors.append(f"embedding flush: {exc}")
        return 0
