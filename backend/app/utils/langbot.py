from typing import List

from app.services.anime_recommendations import _get_animes_by_ids
from app.utils.embeddings import embeddings
from app.utils.qdrant_client import COLLECTION_NAME, client
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_openrouter import ChatOpenRouter
from motor.motor_asyncio import AsyncIOMotorDatabase

BASE_RAG_INFO = "Suggest 1-3 animes based EXCLUSIVELY on the provided context data."
RENDER_HINT = "Use simple Markdown: **bold**, *italic*, and basic bullet lists only. Avoid code blocks, tables, or nested structures that may break rendering."

MODEL_SPECIFIC_INSTRUCTIONS = {
    "google/gemma-4-26b-a4b-it:free": (
        f"{BASE_RAG_INFO} Focus on being fast, concise, and friendly. Use bullet points for readability. {RENDER_HINT}"
    ),
    "openrouter/free": (
        f"{BASE_RAG_INFO} Be detailed in explanations but keep it concise. Mention why each anime matches the user's preference. {RENDER_HINT}"
    ),
}
DEFAULT_PROMPT = f"{BASE_RAG_INFO} Be a helpful anime assistant. {RENDER_HINT}"


def format_docs(docs: List[Document]) -> str:
    if not docs:
        return "No matching anime records found"

    formatted = []
    for doc in docs:
        meta = doc.metadata or {}
        title = meta.get("title", {}) or {}
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
        genres = ", ".join(meta.get("genres", []))
        score = meta.get("averageScore", "N/A")
        episodes = meta.get("episodes", "N/A")
        overview = doc.page_content or meta.get("description", "").strip() or "N/A"

        formatted.append(
            f"--- ANIME SUGGESTION ---\n"
            f"Title: {t_romaji} ({t_english})\n"
            f"Overview: {overview}\n"
            f"Genres: {genres}\n"
            f"Episodes: {episodes}\n"
            f"Score: {score}"
        )

    return "\n\n".join(formatted)


store = {}


def get_history(session_id: str) -> BaseChatMessageHistory:
    if session_id not in store:
        store[session_id] = ChatMessageHistory()
    return store[session_id]


async def retrieve_anime_context(
    query: str, db: AsyncIOMotorDatabase, top_k: int = 5
) -> List[Document]:
    description = (query or "").strip()
    if not description:
        return []

    query_embedding = embeddings.embed_query(description)

    results = client.query_points(
        collection_name=COLLECTION_NAME,
        query=query_embedding,
        limit=top_k,
        with_payload=True,
        with_vectors=False,
    )

    points = results.points if hasattr(results, "points") else results

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

    animes = await _get_animes_by_ids(db, anime_ids[:top_k])

    return [
        Document(
            page_content=(anime.get("description") or "").strip(),
            metadata=anime,
        )
        for anime in animes
    ]


async def langchain_chatbot(
    message: str, model_id: str, db: AsyncIOMotorDatabase, session_id: str = "default"
) -> str:
    instruction = MODEL_SPECIFIC_INSTRUCTIONS.get(model_id, DEFAULT_PROMPT)

    llm = ChatOpenRouter(model=model_id)

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", f"{instruction}\n\nContext:\n{{context}}"),
            MessagesPlaceholder(variable_name="history"),
            ("human", "{question}"),
        ]
    )
    docs = await retrieve_anime_context(message, db)
    context = format_docs(docs)

    rag_chain = prompt | llm | StrOutputParser()

    chain_with_history = RunnableWithMessageHistory(
        rag_chain,
        get_session_history=get_history,
        input_messages_key="question",
        history_messages_key="history",
    )

    response = await chain_with_history.ainvoke(
        {"question": message, "context": context},
        config={"configurable": {"session_id": session_id}},
    )
    return response
