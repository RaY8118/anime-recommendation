import os

import numpy as np
from app.dependencies import get_database
from app.utils.embeddings import generate_embeddings
from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from openai import OpenAI

openrouter_client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.environ.get("OPENROUTER_API_KEY"),
)

CONVERSATION_HISTORY = []
VALID_ROLES = {"user", "model"}
BASE_RAG_INFO = "Suggest 1-3 animes based EXCLUSIVELY on the provided context data."
MODEL_SPECIFIC_INSTRUCTIONS = {
    "mistralai/devstral-2512:free": (
        f"{BASE_RAG_INFO} Focus on being fast, concise, and friendly. "
        "Use bullet points for readability."
    ),
    "openai/gpt-oss-20b:free": (
        f"{BASE_RAG_INFO} Be creative and 'Otaku-like'. "
        "Explain WHY these animes match the user's vibe using colorful language."
    ),
    "meta-llama/llama-3.3-70b-instruct:free": (
        f"{BASE_RAG_INFO} Be highly analytical. Compare the genres and scores "
        "of the suggestions to give a logical reason for each pick. no need to include"
    ),
}

DEFAULT_PROMPT = f"{BASE_RAG_INFO} Be a helpful anime assistant."


async def openrouter_chatbot(
    message: str, model_id: str, db: AsyncIOMotorDatabase = Depends(get_database)
):
    anime_collection = db.animes
    CONVERSATION_HISTORY.append({"role": "user", "message": message})

    message_embedding = await generate_embeddings(message)

    if isinstance(message_embedding, np.ndarray):
        message_embedding = message_embedding.tolist()
    pipeline = [
        {
            "$vectorSearch": {
                "index": "embeddings_vector_index",
                "path": "embedding",
                "queryVector": message_embedding,
                "numCandidates": 100,
                "limit": 15,
            }
        },
        {
            "$project": {
                "_id": 0,
                "id": 1,
                "title": 1,
                "description": 1,
                "averageScore": 1,
                "genres": 1,
                "episodes": 1,
                "duration": 1,
                "season": 1,
                "seasonYear": 1,
                "status": 1,
                "source": 1,
                "studios": 1,
                "coverImage": 1,
                "score": {"$meta": "vectorSearchScore"},
            }
        },
    ]

    cursor = anime_collection.aggregate(pipeline)
    results = [doc async for doc in cursor]

    formatted_animes = [format_anime_for_llm(anime) for anime in results]

    context_string = "\n\n".join(formatted_animes)

    system_instruction = MODEL_SPECIFIC_INSTRUCTIONS.get(model_id, DEFAULT_PROMPT)
    messages = [{"role": "user", "content": system_instruction}]

    for msg in CONVERSATION_HISTORY[-10:]:
        role = "assistant" if msg["role"] == "bot" else "user"
        messages.append({"role": role, "content": msg["message"]})

    current_query_and_content = (
        f"The user's current request is: **{message}**\n\n"
        f"--- CONTENT ANIME DATA ---\n\n{context_string}"
    )

    messages.append({"role": "user", "content": current_query_and_content})

    try:
        response = openrouter_client.chat.completions.create(
            model=model_id,
            messages=messages,  # type: ignore
            extra_headers={
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "Anime Genie Showcase",
            },
        )
        reply = response.choices[0].message.content
    except Exception as e:
        print(f"Error: {e}")
        reply = "I'm having trouble connecting to my brain right now!"

    CONVERSATION_HISTORY.append({"role": "bot", "message": reply})

    if len(CONVERSATION_HISTORY) > 50:
        CONVERSATION_HISTORY.pop(0)

    return reply


def format_anime_for_llm(anime: dict) -> str:
    title_romaji = anime.get("title", {}).get("romaji", "N/A")
    title_english = anime.get("title", {}).get("english", "N/A")
    description = anime.get("description", "No description provied").strip()
    genres = ", ".join(anime.get("genres", []))
    score = anime.get("averageScore", "N/A")
    episodes = anime.get("episodes", "N/A")

    return (
        f"--- ANIME SUGGESTION ---\n"
        f"Title: {title_romaji} ({title_english})\n"
        f"Description: {description}\n"
        f"Genre: {genres}\n"
        f"Episodes: {episodes}\n"
        f"Relevance Score: {anime.get("score", "N/A")}"
    )
