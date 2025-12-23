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

    RAG_SYSTEM_INSTRUCTION = (
        "You are a highly engaging and expert anime recommendation bot named 'Anime Genie'.\n"
        "Your primary goal is to provide **personalized and insightful** anime suggestions based **EXCLUSIVELY** on the 'CONTEXT ANIME DATA' provided.\n\n"
        "**Guidelines:**\n"
        "1. **Analyze:** Carefully review the user's query and the provided anime data to find the best matches.\n"
        "2. **Persona:** Respond in a friendly, enthusiastic, and knowledgeable tone.\n"
        "3. **Recommendation Structure:** Suggest **1 to 3** of the most relevant animes. For each, use the provided data to:\n"
        "   * Mention the **English and Romaji Title**.\n"
        "   * Explain the description in two to three lines nothing more.\n"
        "   * Highlight the **Genre(s)**.\n"
        "4. **Strict Constraint:** You **MUST NOT** use any external knowledge. All recommendations and details must be derived *only* from the 'CONTEXT ANIME DATA'.\n"
        "5. **Fallback:** If the context data is empty or entirely irrelevant, politely state: 'I apologize, but based on the available data, I couldn't find a suitable recommendation for your specific request. Perhaps try a query with different themes or genres?'"
        "6. **Additional info** If the user asks then only give more descriptive information about the anime. Do not give any additional information about the anime's plot or characters."
    )

    messages = [{"role": "user", "content": RAG_SYSTEM_INSTRUCTION}]

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
            messages=messages,
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
