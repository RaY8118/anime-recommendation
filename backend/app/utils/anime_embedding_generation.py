from typing import Any

from langchain_core.documents import Document

from app.utils.qdrant_client import BATCH_SIZE, vector_db


def anime_to_document(anime: dict[str, Any]) -> Document:
    title = anime.get("title") or {}
    romaji = title.get("romaji") or ""
    english = title.get("english") or ""
    genres = anime.get("genres") or []
    description = anime.get("description") or ""

    content = (
        f"Title: {romaji} ({english})\n"
        f"Genres: {', '.join(genres)}\n"
        f"Description: {description}"
    )

    metadata = {
        "anime_id": int(anime["id"]),
        "title_romaji": romaji,
        "title_english": english,
        "genres": genres,
    }

    return Document(
        page_content=content,
        metadata=metadata,
    )


async def generate_anime_embeddings(db):
    collection = db.new_animes
    cursor = collection.find({})

    batch: list[Document] = []
    batch_ids: list[int] = []
    processed = 0
    failed = 0

    async def flush_batch():
        nonlocal processed, failed, batch, batch_ids

        if not batch:
            return

        try:
            vector_db.add_documents(
                documents=batch,
                ids=batch_ids,
            )
            processed += len(batch)
            print(f"Stored {processed} anime so far")

        except Exception as exc:
            print(f"Batch failed: {exc}")

            for document, anime_id in zip(batch, batch_ids):
                try:
                    vector_db.add_documents(
                        documents=[document],
                        ids=[anime_id],
                    )
                    processed += 1
                except Exception as item_exc:
                    failed += 1
                    print(f"Failed anime {anime_id}: {item_exc}")

        finally:
            batch = []
            batch_ids = []

    async for anime in cursor:
        try:
            document = anime_to_document(anime)
            anime_id = int(anime["id"])

            batch.append(document)
            batch_ids.append(anime_id)

            if len(batch) >= BATCH_SIZE:
                await flush_batch()

        except Exception as exc:
            failed += 1
            print(f"Skipping invalid anime: {exc}")

    await flush_batch()

    print(f"Finished. Stored: {processed}, Failed: {failed}")
    return {"processed": processed, "failed": failed}
