import warnings

from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_openrouter import ChatOpenRouter
from motor.motor_asyncio import AsyncIOMotorDatabase

# Suppress the Reviver(`allowed_objects`) pending-deprecation warning that
# langgraph emits at import time (injected inside the library itself).
with warnings.catch_warnings():
    warnings.filterwarnings("ignore", message=r".*`allowed_objects`.*")
    from langgraph.config import get_stream_writer
    from langgraph.graph import END, START, StateGraph

from app.services.chatbot.config import (
    DEFAULT_PROMPT,
    HISTORY_SIZE,
    MODEL_SPECIFIC_INSTRUCTIONS,
)
from app.services.chatbot.retrieval import (
    anime_card,
    build_qdrant_filter,
    extract_query,
    format_docs,
    safe_retrieve_anime_context,
)
from app.services.chatbot.saver import get_checkpointer
from app.services.chatbot.state import ChatState


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
