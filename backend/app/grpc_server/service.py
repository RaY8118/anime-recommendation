"""Ingest business logic — no gRPC types in this module.

Takes a stream of already-decoded anime dicts, validates each through the
Anime schema, upserts the whole validated batch into Mongo in one bulk write
at end-of-stream (ReplaceOne on `id`, ordered=False — same idempotency as
go-fetcher's Store.Upsert, one round-trip instead of N), then flushes a
single Qdrant embedding batch.
"""

import asyncio
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass, field

from pymongo import ReplaceOne

from app.core.deps import DB_NAME, get_mongo_client
from app.core.qdrant import vector_db
from app.schemas.animes import Anime
from app.services.embeddings.generate import anime_to_document

logger = logging.getLogger(__name__)


@dataclass
class IngestResult:
    received: int = 0
    ids: list[int] = field(default_factory=list)
    inserted: int = 0
    upserted: int = 0
    matched: int = 0
    modified: int = 0
    embedded: int = 0
    failed: int = 0
    errors: list[str] = field(default_factory=list)


async def ingest_stream(documents: AsyncIterator[dict]) -> IngestResult:
    db = get_mongo_client().get_database(DB_NAME)
    result = IngestResult()
    collected: list[dict] = []

    async for document in documents:
        result.received += 1
        try:
            validated = Anime(**document).model_dump()
            validated.pop("embedding", None)
            result.ids.append(validated["id"])
            collected.append(validated)
        except Exception as exc:
            result.failed += 1
            result.errors.append(f"id={document.get('id')}: {exc}")

    result.inserted = len(collected)

    if collected:
        await _flush_upserts(db, collected, result)
        result.embedded = await _embed(collected, result)

    return result


async def _flush_upserts(db, documents: list[dict], result: IngestResult) -> None:
    """One unordered ReplaceOne-per-doc write. Counters mirror go-fetcher's
    Store.Upsert WriteResult so the fetcher's backfill reporting stays valid."""
    writes = [ReplaceOne({"id": doc["id"]}, doc, upsert=True) for doc in documents]
    res = await db.new_animes.bulk_write(writes, ordered=False)
    result.upserted = res.upserted_count
    result.matched = res.matched_count
    result.modified = res.modified_count


async def _embed(documents: list[dict], result: IngestResult) -> int:
    """End-of-stream flush: one Qdrant batch for everything validated.

    Runs AFTER the Mongo write so embedding targets documents that actually
    persisted — a Qdrant failure is recoverable via force-reindex, while the
    reverse order could embed data Mongo never saw.
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
