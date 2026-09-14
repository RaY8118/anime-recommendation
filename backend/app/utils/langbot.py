import os
from operator import itemgetter
from typing import List

from app.dependencies import get_sync_mongo_client
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import RunnablePassthrough
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_mongodb import MongoDBAtlasVectorSearch
from langchain_mongodb.retrievers import MongoDBAtlasHybridSearchRetriever
from langchain_openai import OpenAIEmbeddings
from langchain_openrouter import ChatOpenRouter

client = get_sync_mongo_client()
db = client["anime_recommendation"]

embedding_model = OpenAIEmbeddings(
    model="google/gemini-embedding-001",
    base_url="https://openrouter.ai/api/v1",
    api_key=os.environ.get("OPENROUTER_API_KEY"),
    check_embedding_ctx_length=False,
    extra_body={
        "provider": {
            "order": ["Google Vertex"],
        }
    },
)

vector_store = MongoDBAtlasVectorSearch(
    collection=db.embeddings,
    embedding=embedding_model,
    index_name="vector_index",
    text_key="page_content",
    embedding_key="embedding",
)

retriever = MongoDBAtlasHybridSearchRetriever(
    vectorstore=vector_store,
    search_index_name="search_index",
    k=5,
    vector_penalty=60.0,
    fulltext_penalty=60.0,
)

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
        title = meta.get("title", {})
        t_romaji = meta.get("display_romaji", {}) or title.get("romaji", "N/A")
        t_english = meta.get("display_english", {}) or title.get("english", "N/A")
        genres = ", ".join(meta.get("genres", []))
        score = meta.get("averageScore", "N/A")
        episodes = meta.get("episodes", "N/A")

        formatted.append(
            f"--- ANIME SUGGESTION ---\n"
            f"Title: {t_romaji} ({t_english})\n"
            f"Overview: {doc.page_content}\n"
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


async def langchain_chatbot(
    message: str, model_id: str, session_id: str = "default"
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
    context_pipeline = itemgetter("question") | retriever | format_docs

    rag_chain = (
        RunnablePassthrough.assign(context=context_pipeline)
        | prompt
        | llm
        | StrOutputParser()
    )

    chain_with_history = RunnableWithMessageHistory(
        rag_chain,
        get_session_history=get_history,
        input_messages_key="question",
        history_messages_key="history",
    )

    response = await chain_with_history.ainvoke(
        {"question": message}, config={"configurable": {"session_id": session_id}}
    )
    return response
