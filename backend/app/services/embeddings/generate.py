from typing import Any

from app.core.qdrant import BATCH_SIZE, vector_db
from langchain_core.documents import Document


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
        "averageScore": anime.get("averageScore"),
        "episodes": anime.get("episodes"),
        "duration": anime.get("duration"),
        "season": anime.get("season"),
        "seasonYear": anime.get("seasonYear"),
        "status": anime.get("status"),
        "source": anime.get("source"),
        "studios": anime.get("studios") or [],
        "popularity": anime.get("popularity"),
    }

    return Document(
        page_content=content,
        metadata=metadata,
    )


async def generate_anime_embeddings(db, force: bool = False):
    collection = db.new_animes
    cursor = collection.find({}, batch_size=200)
    collection_name = vector_db.collection_name

    batch: list[Document] = []
    batch_ids: list[int] = []
    processed = 0
    failed = 0
    skipped = 0

    existing_ids = set()
    offset = None

    if force:
        print("Force reindex enabled: existing Qdrant points will be overwritten")
    else:
        try:
            while True:
                points, next_offset = vector_db.client.scroll(
                    collection_name=collection_name,
                    limit=1000,
                    offset=offset,
                    with_payload=False,
                    with_vectors=False,
                )

                for point in points:
                    existing_ids.add(int(point.id))

                if next_offset is None:
                    break

                offset = next_offset

            print(f"Found {len(existing_ids)} existing anime in Qdrant")

        except Exception as exc:
            raise RuntimeError(
                f"Could not retrieve existing Qdrant IDs: {exc}"
            ) from exc

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
            existing_ids.update(batch_ids)

            print(f"Stored: {processed}, Skipped: {skipped}, Failed: {failed}")

        except Exception as exc:
            print(f"Batch failed: {exc}")

            for document, anime_id in zip(batch, batch_ids):
                try:
                    vector_db.add_documents(
                        documents=[document],
                        ids=[anime_id],
                    )
                    processed += 1
                    existing_ids.add(anime_id)

                except Exception as item_exc:
                    failed += 1
                    print(f"Failed anime {anime_id}: {item_exc}")

        finally:
            batch = []
            batch_ids = []

    async for anime in cursor:
        try:
            anime_id = int(anime["id"])

            if anime_id in existing_ids:
                skipped += 1
                continue

            document = anime_to_document(anime)

            batch.append(document)
            batch_ids.append(anime_id)

            if len(batch) >= BATCH_SIZE:
                await flush_batch()

        except Exception as exc:
            failed += 1
            print(f"Skipping invalid anime: {exc}")

    await flush_batch()

    print(f"Finished. Stored: {processed}, Skipped: {skipped}, Failed: {failed}")

    return {
        "processed": processed,
        "failed": failed,
        "skipped": skipped,
    }
