import asyncio

from app.core.embeddings import embeddings
from app.core.qdrant import COLLECTION_NAME, client
from app.services.anime_recommendations import _get_animes_by_ids
from app.services.chatbot.config import (
    EXTRACTION_INSTRUCTION,
    EXTRACTION_TIMEOUT_SECONDS,
    RETRIEVAL_CANDIDATES,
    RETRIEVAL_TIMEOUT_SECONDS,
    RETRIEVAL_TOP_K,
)
from app.services.chatbot.models import AnimeQuery
from langchain_core.documents import Document
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_openrouter import ChatOpenRouter
from motor.motor_asyncio import AsyncIOMotorDatabase
from qdrant_client.http.models import FieldCondition, Filter, MatchValue, Range


async def extract_query(
    message: str, history: list[BaseMessage], model_id: str
) -> AnimeQuery:
    try:
        llm = ChatOpenRouter(model=model_id).with_structured_output(AnimeQuery)
        messages: list[BaseMessage] = [SystemMessage(content=EXTRACTION_INSTRUCTION)]
        messages.extend(history[-6:])
        messages.append(HumanMessage(content=message))

        result = await asyncio.wait_for(
            llm.ainvoke(messages), timeout=EXTRACTION_TIMEOUT_SECONDS
        )
        if isinstance(result, dict):
            result = AnimeQuery(**result)
        if not isinstance(result, AnimeQuery):
            return AnimeQuery(query=message)
        if not result.query.strip():
            result.query = message
        return result
    except Exception as exc:
        print(f"Query extraction failed, falling back to raw message: {exc}")
        return AnimeQuery(query=message)


def build_qdrant_filter(anime_query: AnimeQuery) -> Filter | None:
    must = []

    if anime_query.genres:
        must.append(
            Filter(
                should=[
                    FieldCondition(key="metadata.genres", match=MatchValue(value=g))
                    for g in anime_query.genres
                ]
            )
        )
    if anime_query.studios:
        must.append(
            Filter(
                should=[
                    FieldCondition(key="metadata.studios", match=MatchValue(value=s))
                    for s in anime_query.studios
                ]
            )
        )
    if anime_query.status:
        must.append(
            Filter(
                should=[
                    FieldCondition(key="metadata.status", match=MatchValue(value=s))
                    for s in anime_query.status
                ]
            )
        )
    if anime_query.season:
        must.append(
            Filter(
                should=[
                    FieldCondition(key="metadata.season", match=MatchValue(value=s))
                    for s in anime_query.season
                ]
            )
        )
    if anime_query.year_from is not None or anime_query.year_to is not None:
        must.append(
            FieldCondition(
                key="metadata.seasonYear",
                range=Range(gte=anime_query.year_from, lte=anime_query.year_to),
            )
        )
    if anime_query.min_score is not None:
        must.append(
            FieldCondition(
                key="metadata.averageScore",
                range=Range(gte=anime_query.min_score),
            )
        )

    if not must:
        return None

    return Filter(must=must)


def _query_qdrant(
    query_embedding: list[float], filters: Filter | None, limit: int
) -> list:
    try:
        results = client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_embedding,
            query_filter=filters,
            limit=limit,
            with_payload=True,
            with_vectors=False,
        )
        return results.points if hasattr(results, "points") else results
    except Exception as exc:
        print(f"Qdrant query failed: {exc}")
        return []


async def retrieve_anime_context(
    query: str,
    db: AsyncIOMotorDatabase,
    filters: Filter | None = None,
    top_k: int = RETRIEVAL_TOP_K,
    candidates: int = RETRIEVAL_CANDIDATES,
) -> list[Document]:
    text = (query or "").strip()
    if not text:
        return []

    try:
        query_embedding = await asyncio.to_thread(embeddings.embed_query, text)
    except Exception as exc:
        print(f"Embedding generation failed: {exc}")
        return []

    points = await asyncio.to_thread(
        _query_qdrant, query_embedding, filters, candidates
    )

    if not points and filters is not None:
        points = await asyncio.to_thread(
            _query_qdrant, query_embedding, None, candidates
        )

    if not points:
        return []

    anime_ids = []
    seen = set()
    for point in points:
        payload = getattr(point, "payload", None) or {}
        metadata = payload.get("metadata") or {}
        aid = metadata.get("anime_id") or getattr(point, "id", None)
        if aid is not None and aid not in seen:
            seen.add(aid)
            anime_ids.append(aid)

    try:
        animes = await _get_animes_by_ids(db, anime_ids[:top_k])
    except Exception as exc:
        print(f"Fetching anime details failed: {exc}")
        return []

    return [
        Document(
            page_content=(anime.get("description") or "").strip(),
            metadata=anime,
        )
        for anime in animes
    ]


async def safe_retrieve_anime_context(
    query: str, db: AsyncIOMotorDatabase, filters: Filter | None = None
) -> list[Document]:
    try:
        return await asyncio.wait_for(
            retrieve_anime_context(query, db, filters),
            timeout=RETRIEVAL_TIMEOUT_SECONDS,
        )
    except Exception as exc:
        print(f"Retrieval timed out or failed: {exc}")
        return []


def format_docs(docs: list[Document]) -> str:
    if not docs:
        return "No matching anime records found"

    formatted = []
    for doc in docs:
        meta = doc.metadata or {}
        title = meta.get("title") or {}
        t_romaji = (
            meta.get("display_romaji")
            or title.get("romaji")
            or meta.get("title_romaji")
            or "N/A"
        )
        t_english = (
            meta.get("display_english")
            or title.get("english")
            or meta.get("title_english")
            or "N/A"
        )
        genres = ", ".join(meta.get("genres") or [])
        studios = ", ".join(meta.get("studios") or [])
        score = meta.get("averageScore", "N/A")
        episodes = meta.get("episodes", "N/A")
        duration = meta.get("duration", "N/A")
        season = meta.get("season") or "N/A"
        year = meta.get("seasonYear") or "N/A"
        status = meta.get("status") or "N/A"
        popularity = meta.get("popularity", "N/A")
        overview = doc.page_content or (meta.get("description") or "").strip() or "N/A"

        formatted.append(
            f"--- ANIME SUGGESTION ---\n"
            f"Title: {t_romaji} ({t_english})\n"
            f"Overview: {overview}\n"
            f"Genres: {genres}\n"
            f"Studios: {studios}\n"
            f"Episodes: {episodes}\n"
            f"Duration (min): {duration}\n"
            f"Season: {season} {year}\n"
            f"Status: {status}\n"
            f"Score: {score}\n"
            f"Popularity: {popularity}"
        )

    return "\n\n".join(formatted)


def anime_card(meta: dict) -> dict:
    title = meta.get("title") or {}
    return {
        "id": meta.get("id") or meta.get("anime_id"),
        "title": (
            meta.get("display_english")
            or title.get("english")
            or meta.get("display_romaji")
            or title.get("romaji")
            or meta.get("title_romaji")
            or "N/A"
        ),
        "cover": (meta.get("coverImage") or {}).get("large"),
        "score": meta.get("averageScore"),
        "year": meta.get("seasonYear"),
        "genres": (meta.get("genres") or [])[:3],
    }
