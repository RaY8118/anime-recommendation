import os
import numpy as np
from dotenv import load_dotenv
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_openrouter import ChatOpenRouter
from motor.motor_asyncio import AsyncIOMotorDatabase

load_dotenv()

embedding_model = GoogleGenerativeAIEmbeddings(model="gemini-embedding-001")
llm = ChatOpenRouter(model="openai/gpt-oss-20b:free")

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
    message: str, model_id: str, db: AsyncIOMotorDatabase, session_id: str = "default"
):
    message_embedding = await embedding_model.aembed_query(message)

    if not message_embedding:
        return "I'm having trouble generating embeddings right now. Please try again."

    if isinstance(message_embedding, np.ndarray):
        message_embedding = message_embedding.tolist()

    pipeline = [
        {
            "$vectorSearch": {
                "index": "vector_index",
                "path": "embedding",
                "queryVector": message_embedding,
                "numCandidates": 100,
                "limit": 15,
            }
        },
        {
            "$project": {
                "_id": 0,
                "anime_id": 1,
                "title_romaji": 1,
                "score": {"$meta": "vectorSearchScore"},
            }
        },
    ]

    cursor = db.embeddings.aggregate(pipeline)
    embedding_results = [doc async for doc in cursor]

    if not embedding_results:
        return "I couldn't find any matching anime in the database."

    anime_ids = [doc.get("anime_id") for doc in embedding_results if doc.get("anime_id")]

    if not anime_ids:
        return "I couldn't find any matching anime in the database."

    animes_cursor = db.animes.find({"id": {"$in": anime_ids}})
    animes = [doc async for doc in animes_cursor]

    if not animes:
        return "I couldn't find any matching anime in the database."

    formatted_animes = [format_anime_for_llm(anime) for anime in animes]

    model_instruction = MODEL_SPECIFIC_INSTRUCTIONS.get(model_id, DEFAULT_PROMPT)

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", f"{model_instruction}\n\nContext:\n{{context}}"),
            MessagesPlaceholder(variable_name="history", optional=True),
            ("human", "{{question}}"),
        ]
    )

    history = get_history(session_id)

    stuff_chain = prompt | llm | StrOutputParser()

    response = await stuff_chain.ainvoke(
        {
            "context": "\n\n".join(formatted_animes),
            "history": history.messages,
            "question": message,
        }
    )

    history.add_user_message(message)
    history.add_ai_message(response)

    return response


def format_anime_for_llm(anime: dict) -> str:
    title_romaji = anime.get("title", {}).get("romaji", "N/A")
    title_english = anime.get("title", {}).get("english", "N/A")
    description = anime.get("description", "No description provided").strip()
    genres = ", ".join(anime.get("genres", []))
    score = anime.get("averageScore", "N/A")
    episodes = anime.get("episodes", "N/A")

    return (
        f"--- ANIME SUGGESTION ---\n"
        f"Title: {title_romaji} ({title_english})\n"
        f"Description: {description}\n"
        f"Genre: {genres}\n"
        f"Episodes: {episodes}\n"
        f"Score: {score}"
    )