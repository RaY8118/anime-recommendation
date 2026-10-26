import asyncio
import os
import warnings
from typing import Annotated, TypedDict

from dotenv import load_dotenv
from langchain_core.documents import Document
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_openrouter import ChatOpenRouter

# Suppress the Reviver(`allowed_objects`) pending-deprecation warning that
# langgraph emits at import time (injected inside the library itself).
with warnings.catch_warnings():
    warnings.filterwarnings("ignore", message=r".*`allowed_objects`.*")
    from langgraph.config import get_stream_writer
    from langgraph.graph import END, START, StateGraph
    from langgraph.graph.message import add_messages

    from app.utils.redis_lite_saver import AsyncRedisLiteSaver

from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field
from qdrant_client.http.models import FieldCondition, Filter, MatchValue, Range

from app.services.anime_recommendations import _get_animes_by_ids
from app.utils.embeddings import embeddings
from app.utils.qdrant_client import COLLECTION_NAME, client

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL")
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


class ChatState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    docs: list[Document]


_checkpointer: AsyncRedisLiteSaver | None = None
_checkpointer_ready = False
_checkpointer_lock = asyncio.Lock()


async def get_checkpointer() -> AsyncRedisLiteSaver:
    global _checkpointer, _checkpointer_ready

    if _checkpointer is not None and _checkpointer_ready:
        return _checkpointer

    async with _checkpointer_lock:
        if _checkpointer is None:
            if not REDIS_URL:
                raise RuntimeError("REDIS_URL is not configured")
            _checkpointer = AsyncRedisLiteSaver(
                redis_url=REDIS_URL,
                ttl_seconds=REDIS_HISTORY_TTL,
            )
        if not _checkpointer_ready:
            await _checkpointer.asetup()
            _checkpointer_ready = True

    return _checkpointer


async def setup_checkpointer() -> None:
    await get_checkpointer()


async def close_checkpointer() -> None:
    global _checkpointer, _checkpointer_ready

    async with _checkpointer_lock:
        if _checkpointer is not None:
            try:
                await _checkpointer.close()
            except Exception as exc:
                print(f"Closing Redis checkpointer failed: {exc}")
        _checkpointer = None
        _checkpointer_ready = False


async def clear_chat_history(session_id: str) -> None:
    try:
        checkpointer = await get_checkpointer()
        await checkpointer.adelete_thread(session_id)
    except Exception as exc:
        print(f"Clearing chat history failed: {exc}")


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


async def _build_session_graph(db: AsyncIOMotorDatabase, model_id: str):
    checkpointer = await get_checkpointer()
    instruction = MODEL_SPECIFIC_INSTRUCTIONS.get(model_id, DEFAULT_PROMPT)

    async def retrieve_node(state: ChatState) -> dict:
        messages = list(state.get("messages") or [])
        if not messages:
            return {"docs": []}

        current = messages[-1]
        prior = messages[:-1][-HISTORY_SIZE:]
        message_text = (
            current.content
            if isinstance(current.content, str)
            else str(current.content)
        )

        anime_query = await extract_query(message_text, prior, model_id)
        qdrant_filter = build_qdrant_filter(anime_query)

        writer = get_stream_writer()
        if writer is not None:
            writer({"event": "status", "data": {"stage": "searching"}})

        docs = await safe_retrieve_anime_context(
            anime_query.query or message_text, db, qdrant_filter
        )

        if writer is not None and docs:
            writer(
                {
                    "event": "sources",
                    "data": {"anime": [anime_card(doc.metadata or {}) for doc in docs]},
                }
            )

        return {"docs": docs}

    async def chat_node(state: ChatState) -> dict:
        messages = list(state.get("messages") or [])
        if not messages:
            return {"messages": []}

        current = messages[-1]
        history = messages[:-1][-HISTORY_SIZE:]
        message_text = (
            current.content
            if isinstance(current.content, str)
            else str(current.content)
        )

        docs = state.get("docs") or []
        context = format_docs(docs)

        prompt = ChatPromptTemplate.from_messages(
            [
                ("system", f"{instruction}\n\nContext:\n{{context}}"),
                MessagesPlaceholder(variable_name="history"),
                ("human", "{question}"),
            ]
        )

        llm = ChatOpenRouter(model=model_id)
        chain = prompt | llm

        response = await chain.ainvoke(
            {"context": context, "history": history, "question": message_text}
        )
        return {"messages": [response]}

    builder = StateGraph(ChatState)
    builder.add_node("retrieve", retrieve_node)
    builder.add_node("chat", chat_node)
    builder.add_edge(START, "retrieve")
    builder.add_edge("retrieve", "chat")
    builder.add_edge("chat", END)

    return builder.compile(checkpointer=checkpointer)


async def langchain_chatbot(
    message: str, model_id: str, db: AsyncIOMotorDatabase, session_id: str = "default"
) -> str:
    try:
        graph = await _build_session_graph(db, model_id)
        result = await asyncio.wait_for(
            graph.ainvoke(
                {"messages": [HumanMessage(content=message)]},
                config={"configurable": {"thread_id": session_id}},
            ),
            timeout=LLM_TIMEOUT_SECONDS,
        )
    except Exception as exc:
        print(f"Chatbot LLM call failed: {exc}")
        return "I'm having trouble connecting to my brain right now!"

    final_messages = result.get("messages") or []
    if not final_messages:
        return "I'm having trouble connecting to my brain right now!"

    answer = final_messages[-1].content
    return answer if isinstance(answer, str) else str(answer)


async def stream_chatbot(
    message: str, model_id: str, db: AsyncIOMotorDatabase, session_id: str = "default"
):
    yield ("status", {"stage": "thinking"})

    try:
        graph = await _build_session_graph(db, model_id)
    except Exception as exc:
        print(f"Loading chat history failed: {exc}")
        yield (
            "error",
            {"message": "I'm having trouble connecting to my brain right now!"},
        )
        return

    stream = graph.astream(
        {"messages": [HumanMessage(content=message)]},
        {"configurable": {"thread_id": session_id}},
        stream_mode=["messages", "custom"],
    ).__aiter__()

    chunks: list[str] = []
    try:
        while True:
            try:
                event = await asyncio.wait_for(
                    stream.__anext__(), timeout=STREAM_TIMEOUT_SECONDS
                )
            except StopAsyncIteration:
                break

            if not event:
                continue

            mode, payload = event

            if mode == "messages":
                chunk, metadata = payload
                text = getattr(chunk, "content", None)
                if (
                    metadata.get("langgraph_node") == "chat"
                    and isinstance(text, str)
                    and text
                ):
                    chunks.append(text)
                    yield ("token", {"text": text})
            elif mode == "custom":
                event_name = (payload or {}).get("event")
                data = (payload or {}).get("data")
                if event_name == "status" and data:
                    yield ("status", data)
                elif event_name == "sources" and data:
                    yield ("sources", data)
    except Exception as exc:
        print(f"Streaming failed: {exc}")
        yield (
            "error",
            {"message": "I'm having trouble connecting to my brain right now!"},
        )
        return

    answer = "".join(chunks)

    yield ("done", {"text": answer})
