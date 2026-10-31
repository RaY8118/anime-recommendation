from app.core.qdrant import client, embeddings
from app.core.sfw import (
    apply_sfw_mongo_filter,
    is_adult_content,
    merge_sfw_qdrant_filter,
)
from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from qdrant_client.http.models import FieldCondition, Filter, MatchValue


async def _get_animes_by_ids(
    db: AsyncIOMotorDatabase,
    ids: list[int],
    projection: dict | None = None,
    sfw: bool = True,
) -> list[dict]:
    if not ids:
        return []

    projection = projection or {"_id": 0}

    mongo_query = apply_sfw_mongo_filter({"id": {"$in": ids}}, sfw)
    cursor = db.new_animes.find(mongo_query, projection)
    anime_list = await cursor.to_list(length=len(ids))

    anime_by_id = {anime["id"]: anime for anime in anime_list}
    ordered_results = [anime_by_id[aid] for aid in ids if aid in anime_by_id]
    return ordered_results


async def retrieve_by_name(
    query: str, db: AsyncIOMotorDatabase, top_k: int = 5, sfw: bool = True
) -> list[dict]:
    anime_collection = db.new_animes

    anime = await anime_collection.find_one(
        {
            "$or": [
                {"title.romaji": (query or "").lower()},
                {"title.english": (query or "").lower()},
            ]
        }
    )

    if not anime:
        raise HTTPException(status_code=404, detail="Anime not found")

    if sfw and is_adult_content(anime.get("genres")):
        raise HTTPException(status_code=404, detail="Anime not found")

    anime_id = anime["id"]

    if not anime_id:
        raise HTTPException(status_code=404, detail="Anime not found")

    points = client.retrieve(
        collection_name="anime",
        ids=[anime_id],
        with_vectors=True,
        with_payload=True,
    )

    if not points or not points[0].vector:
        raise HTTPException(
            status_code=404, detail="Anime embedding not found in Qdrant"
        )

    embedding = points[0].vector

    results = client.query_points(
        collection_name="anime",
        query=embedding,
        limit=top_k + 1,
        with_payload=True,
        query_filter=merge_sfw_qdrant_filter(
            Filter(
                must_not=[
                    FieldCondition(
                        key="metadata.anime_id", match=MatchValue(value=anime_id)
                    )
                ]
            ),
            sfw,
        ),
    ).points

    if not results:
        raise HTTPException(status_code=404, detail="No similar animes found")

    recommended_ids = []
    for point in results:
        payload = point.payload or {}
        metadata = payload.get("metadata") or {}
        aid = metadata.get("anime_id") or point.id
        recommended_ids.append(aid)

    return await _get_animes_by_ids(db, recommended_ids[:top_k], sfw=sfw)


async def retrieve_by_genre(
    query: str, db: AsyncIOMotorDatabase, top_k: int = 5, sfw: bool = True
) -> list[dict]:
    genres = [
        genre.strip().title() for genre in (query or "").split(",") if genre.strip()
    ]

    if not genres:
        return []

    if sfw and any(is_adult_content([genre]) for genre in genres):
        return []

    genre_filter = Filter(
        must=[
            FieldCondition(key="metadata.genres", match=MatchValue(value=genre))
            for genre in genres
        ]
    )

    points, _ = client.scroll(
        collection_name="anime",
        scroll_filter=merge_sfw_qdrant_filter(genre_filter, sfw),
        limit=top_k,
        with_payload=True,
        with_vectors=False,
    )

    if not points:
        return []

    anime_ids = []
    seen = set()
    for point in points:
        payload = point.payload or {}
        metadata = payload.get("metadata") or {}
        aid = metadata.get("anime_id") or point.id
        if aid not in seen:
            seen.add(aid)
            anime_ids.append(aid)

    return await _get_animes_by_ids(db, anime_ids[:top_k], sfw=sfw)


async def retrieve_by_description(
    query: str, db: AsyncIOMotorDatabase, top_k: int = 5, sfw: bool = True
) -> list[dict]:
    description = (query or "").strip()

    if not description:
        return []

    user_embeddings = embeddings.embed_query(description)

    points = client.query_points(
        collection_name="anime",
        query=user_embeddings,
        limit=top_k,
        with_payload=True,
        with_vectors=False,
        query_filter=merge_sfw_qdrant_filter(None, sfw),
    ).points

    if not points:
        return []

    anime_ids = []
    seen = set()
    for point in points:
        payload = point.payload or {}
        metadata = payload.get("metadata") or {}
        aid = metadata.get("anime_id") or point.id
        if aid not in seen:
            seen.add(aid)
            anime_ids.append(aid)

    return await _get_animes_by_ids(db, anime_ids[:top_k], sfw=sfw)
