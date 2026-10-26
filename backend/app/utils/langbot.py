import asyncio
import os

from dotenv import load_dotenv
from langchain_community.chat_message_histories import RedisChatMessageHistory
from langchain_core.documents import Document
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_openrouter import ChatOpenRouter
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field
from qdrant_client.http.models import FieldCondition, Filter, MatchValue, Range

from app.services.anime_recommendations import _get_animes_by_ids
from app.utils.embeddings import embeddings
from app.utils.qdrant_client import COLLECTION_NAME, client

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL")
REDIS_KEY_PREFIX = "nekorec:chat:"
REDIS_HISTORY_TTL = int(os.getenv("REDIS_HISTORY_TTL", "86400"))
HISTORY_SIZE = 20
RETRIEVAL_TOP_K = 8
RETRIEVAL_CANDIDATES = 20
LLM_TIMEOUT_SECONDS = 60
STREAM_TIMEOUT_SECONDS = 120
EXTRACTION_TIMEOUT_SECONDS = 15
RETRIEVAL_TIMEOUT_SECONDS = 25

BASE_RAG_INFO = "Suggest 1-3 animes based EXCLUSIVELY on the provided context data."
RENDER_HINT = "Use simple Markdown: **bold**, *italic*, and basic bullet lists only. Avoid code blocks, tables, or nested structures that may break rendering."

MODEL_SPECIFIC_INSTRUCTIONS = {
    "google/gemini-2.5-flash-lite": (
        f"{
            BASE_RAG_INFO
        } Focus on being fast, concise, and friendly. Use bullet points for readability. {
            RENDER_HINT
        }"
    ),
    "openrouter/free": (
        f"{BASE_RAG_INFO} Be detailed in explanations but keep it concise. Mention why each anime matches the user's preference. {RENDER_HINT}"
    ),
}
DEFAULT_PROMPT = f"{BASE_RAG_INFO} Be a helpful anime assistant. {RENDER_HINT}"

EXTRACTION_INSTRUCTION = (
    "You convert a user's anime request into a structured search. "
    "as 'more like that'). Separately extract any hard constraints the user explicitly "
    "stated or clearly implied: genre, studio, release year range, minimum score, "
    "release status, and season. Only extract constraints that are present; leave "
    "everything else empty or null. Use canonical English names in Title Case for "
    "genres and studios. Do not invent constraints. If the user names no constraint, "
    "    return empty lists and null values."
)


class AnimeQuery(BaseModel):
    query: str = Field(
        description=(
            "A standalone, self-contained anime search query rewritten from the "
            "user's message and the conversation so far. Do not put filters here."
        )
    )
    genres: list[str] = Field(
        default_factory=list,
        description="AniList genre names in Title Case (e.g. 'Action', 'Sci-Fi').",
    )
    studios: list[str] = Field(
        default_factory=list,
        description="Studio names in Title Case (e.g. 'Madhouse').",
    )
    year_from: int | None = Field(
        default=None, description="Earliest release year the user asked for."
    )
    year_to: int | None = Field(
        default=None, description="Latest release year the user asked for."
    )
    min_score: int | None = Field(
        default=None, description="Minimum average score (0-100) the user asked for."
    )
    status: list[str] = Field(
        default_factory=list,
        description=(
            "Release status. Allowed values: FINISHED, RELEASING, "
            "NOT_YET_RELEASED, CANCELLED, HIATUS."
        ),
    )
    season: list[str] = Field(
        default_factory=list,
        description="Season of release. Allowed values: WINTER, SPRING, SUMMER, FALL.",
    )


class BoundedRedisChatMessageHistory(RedisChatMessageHistory):
    def __init__(self, *args, max_messages: int = HISTORY_SIZE, **kwargs):
        super().__init__(*args, **kwargs)
        self.max_messages = max_messages

    def add_message(self, message: BaseMessage) -> None:
        super().add_message(message)
        try:
            self.redis_client.ltrim(self.key, 0, self.max_messages - 1)
        except Exception as exc:
            print(f"Trimming Redis chat history failed: {exc}")


def _get_history(session_id: str) -> BoundedRedisChatMessageHistory:
    if not REDIS_URL:
        raise RuntimeError("REDIS_URL is not configured")

    return BoundedRedisChatMessageHistory(
        session_id=session_id,
        url=REDIS_URL,
        key_prefix=REDIS_KEY_PREFIX,
        ttl=REDIS_HISTORY_TTL,
        max_messages=HISTORY_SIZE,
    )


async def clear_chat_history(session_id: str) -> None:
    history = await asyncio.to_thread(_get_history, session_id)
    await asyncio.to_thread(history.clear)


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


async def langchain_chatbot(
    message: str, model_id: str, db: AsyncIOMotorDatabase, session_id: str = "default"
) -> str:
    instruction = MODEL_SPECIFIC_INSTRUCTIONS.get(model_id, DEFAULT_PROMPT)

    try:
        history = await asyncio.to_thread(_get_history, session_id)
        history_messages = await asyncio.to_thread(lambda: history.messages)
    except Exception as exc:
        print(f"Loading chat history failed: {exc}")
        history_messages = []

    anime_query = await extract_query(message, history_messages, model_id)
    qdrant_filter = build_qdrant_filter(anime_query)
    docs = await safe_retrieve_anime_context(
        anime_query.query or message, db, qdrant_filter
    )
    context = format_docs(docs)

    llm = ChatOpenRouter(model=model_id)

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", f"{instruction}\n\nContext:\n{{context}}"),
            MessagesPlaceholder(variable_name="history"),
            ("human", "{question}"),
        ]
    )

    rag_chain = prompt | llm | StrOutputParser()

    chain_with_history = RunnableWithMessageHistory(
        rag_chain,
        get_session_history=_get_history,
        input_messages_key="question",
        history_messages_key="history",
    )

    try:
        response = await asyncio.wait_for(
            chain_with_history.ainvoke(
                {"question": message, "context": context},
                config={"configurable": {"session_id": session_id}},
            ),
            timeout=LLM_TIMEOUT_SECONDS,
        )
    except Exception as exc:
        print(f"Chatbot LLM call failed: {exc}")
        return "I'm having trouble connecting to my brain right now!"

    return response


async def stream_chatbot(
    message: str, model_id: str, db: AsyncIOMotorDatabase, session_id: str = "default"
):
    instruction = MODEL_SPECIFIC_INSTRUCTIONS.get(model_id, DEFAULT_PROMPT)

    try:
        history = await asyncio.to_thread(_get_history, session_id)
        history_messages = await asyncio.to_thread(lambda: history.messages)
    except Exception as exc:
        print(f"Loading chat history failed: {exc}")
        history = None
        history_messages = []

    yield ("status", {"stage": "thinking"})

    anime_query = await extract_query(message, history_messages, model_id)
    qdrant_filter = build_qdrant_filter(anime_query)

    yield ("status", {"stage": "searching"})

    docs = await safe_retrieve_anime_context(
        anime_query.query or message, db, qdrant_filter
    )
    context = format_docs(docs)

    if docs:
        yield ("sources", {"anime": [anime_card(doc.metadata or {}) for doc in docs]})

    llm = ChatOpenRouter(model=model_id)

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", f"{instruction}\n\nContext:\n{{context}}"),
            MessagesPlaceholder(variable_name="history"),
            ("human", "{question}"),
        ]
    )

    chain = prompt | llm | StrOutputParser()

    stream = chain.astream(
        {"question": message, "context": context, "history": history_messages}
    ).__aiter__()

    chunks: list[str] = []
    try:
        while True:
            try:
                chunk = await asyncio.wait_for(
                    stream.__anext__(), timeout=STREAM_TIMEOUT_SECONDS
                )
            except StopAsyncIteration:
                break

            if chunk:
                chunks.append(chunk)
                yield ("token", {"text": chunk})
    except Exception as exc:
        print(f"Streaming failed: {exc}")
        yield (
            "error",
            {"message": "I'm having trouble connecting to my brain right now!"},
        )
        return

    answer = "".join(chunks)

    if history is not None and answer:
        try:
            await asyncio.to_thread(
                history.add_messages,
                [HumanMessage(content=message), AIMessage(content=answer)],
            )
        except Exception as exc:
            print(f"Saving chat history failed: {exc}")

    yield ("done", {"text": answer})
