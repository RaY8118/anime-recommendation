from typing import Any

from langchain_community.embeddings.fastembed import FastEmbedEmbeddings
from langchain_core.documents import Document
from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams

COLLECTION_NAME = "anime"
BATCH_SIZE = 200
VECTOR_SIZE = 512

client = QdrantClient(path="./qdrant_data")

embeddings = FastEmbedEmbeddings(model_name="BAAI/bge-small-zh-v1.5")

if not client.collection_exists(COLLECTION_NAME):
    client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(
            size=VECTOR_SIZE,
            distance=Distance.COSINE,
        ),
    )

vector_db = QdrantVectorStore(
    client=client,
    collection_name=COLLECTION_NAME,
    embedding=embeddings,
)


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
