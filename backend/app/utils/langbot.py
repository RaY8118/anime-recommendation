import os

import numpy as np
from dotenv import load_dotenv
from fastapi import Depends
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_openrouter import ChatOpenRouter
from motor.motor_asyncio import AsyncIOMotorDatabase
from openai import OpenAI

load_dotenv()

openrouter_client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.environ.get("OPENROUTER_API_KEY"),
)

llm = ChatOpenRouter(model="openai/gpt-oss-20b:free")

BASE_RAG_INFO = "Suggest 1-3 animes based EXCLUSIVELY on the provided context data."
MODEL_SPECIFIC_INSTRUCTIONS = {
    "google/gemma-3n-e4b-it:free": (
        f"{BASE_RAG_INFO} Focus on being fast, concise, and friendly. "
        "Use bullet points for readability."
    )
}

DEFAULT_PROMPT = f"{BASE_RAG_INFO} Be a helpful anime assistant."

CONVERSATION_HISTORY = []


async def generate_query_embedding(text: str) -> list:
    from google import genai

    client = genai.Client()
    try:
        response = client.models.embed_content(
            model="gemini-embedding-001", contents=text
        )
        if response.embeddings:
            return response.embeddings[0].values
    except Exception as e:
        print(f"Embedding error: {e}")
    return None


async def langchain_chatbot(message: str, model_id: str, db: AsyncIOMotorDatabase):
    message_embedding = await generate_query_embedding(message)

    if message_embedding is None:
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
    results = []
    async for doc in cursor:
        results.append(doc)

    anime_ids = [doc.get("anime_id") for doc in results if doc.get("anime_id")]

    animes_cursor = db.animes.find({"id": {"$in": anime_ids}})
    animes = []
    async for doc in animes_cursor:
        animes.append(doc)

    formatted_animes = [format_anime_for_llm(anime) for anime in animes]
    context_string = "\n\n".join(formatted_animes)

    if not context_string:
        return "I couldn't find any matching anime in the database."

    history_str = ""
    for msg in CONVERSATION_HISTORY[-10:]:
        role = "User" if msg["role"] == "user" else "Assistant"
        history_str += f"{role}: {msg['message']}\n"

    template = (
        f"{MODEL_SPECIFIC_INSTRUCTIONS.get(model_id, DEFAULT_PROMPT)}\n\n"
        "Context:\n{{context}}\n\n"
        "Previous conversation:\n{chat_history_str}\n\n"
        "Question: {{question}}"
    ).format(chat_history_str=history_str if history_str else "No previous messages")
    prompt = PromptTemplate.from_template(template)

    chain = (
        {
            "context": lambda x: context_string,
            "question": RunnablePassthrough(),
        }
        | prompt
        | llm
        | StrOutputParser()
    )

    reply = chain.invoke(message)

    CONVERSATION_HISTORY.append({"role": "user", "message": message})
    CONVERSATION_HISTORY.append({"role": "assistant", "message": reply})

    if len(CONVERSATION_HISTORY) > 50:
        CONVERSATION_HISTORY.pop(0)

    return reply


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
