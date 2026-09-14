import os

from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_mongodb import MongoDBAtlasVectorSearch
from langchain_mongodb.retrievers import MongoDBAtlasHybridSearchRetriever
from langchain_openai import OpenAIEmbeddings
from langchain_openrouter import ChatOpenRouter
from pymongo import MongoClient

client = MongoClient(os.getenv("MONGODB_URI"))
db = client["anime_recommendation"]

llm = ChatOpenRouter(model="openrouter/free")

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

BASE_RAG_INFO = "Suggest 1-3 animes based EXCLUSIVELY on the provided context data."
RENDER_HINT = "Use simple Markdown: **bold**, *italic*, and basic bullet lists only. Avoid code blocks, tables, or nested structures that may break rendering."

MODEL_SPECIFIC_INSTRUCTIONS = {
    "google/gemma-3n-e4b-it:free": (
        f"{BASE_RAG_INFO} Focus on being fast, concise, and friendly. "
        f"Use bullet points for readability. {RENDER_HINT}"
    ),
    "openai/gpt-oss-20b:free": (
        f"{BASE_RAG_INFO} Be detailed in explanations but keep it concise. "
        f"Mention why each anime matches the user's preference. {RENDER_HINT}"
    ),
}

DEFAULT_PROMPT = f"{BASE_RAG_INFO} Be a helpful anime assistant."

store = {}


def get_history(session_id: str) -> BaseChatMessageHistory:
    if session_id not in store:
        store[session_id] = ChatMessageHistory()
    return store[session_id]


async def langchain_chatbot(
    message: str,
    model_id: str,
    session_id: str = "default",
):
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

    docs = await retriever.ainvoke(message)

    if not docs:
        return "I couldn't find any matching anime in the database."

    formatted_animes = []
    for doc in docs:
        metadata = doc.metadata or {}
        title_info = metadata.get("title", {})

        title_romaji = title_info.get("display_romaji") or title_info.get(
            "romaji", "N/A"
        )
        title_english = title_info.get("display_english") or title_info.get(
            "english", "N/A"
        )
        genres = ", ".join(metadata.get("genres", []))
        score = metadata.get("averageScore", "N/A")
        episodes = metadata.get("episodes", "N/A")

        formatted_animes.append(
            f"--- ANIME SUGGESTION ---\n"
            f"Title: {title_romaji} ({title_english})\n"
            f"Overview: {doc.page_content}\n"
            f"Genres: {genres}\n"
            f"Episodes: {episodes}\n"
            f"Score: {score}"
        )

    model_instruction = MODEL_SPECIFIC_INSTRUCTIONS.get(model_id, DEFAULT_PROMPT)

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", f"{model_instruction}\n\nContext:\n{{context}}"),
            MessagesPlaceholder(variable_name="history", optional=True),
            ("human", "{{question}}"),
        ]
    )

    history = get_history(session_id)

    chain = prompt | llm | StrOutputParser()

    response = await chain.ainvoke(
        {
            "context": "\n\n".join(formatted_animes),
            "history": history.messages,
            "question": message,
        }
    )

    history.add_user_message(message)
    history.add_ai_message(response)

    return response
