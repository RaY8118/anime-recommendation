from app.utils.embeddings import generate_embeddings
import numpy as np
from app.dependencies import db
from app.utils.anime_api import process_anime
from google import genai

client = genai.Client()

anime_collection = db.animes

CONVERSATION_HISTORY = []
VALID_ROLES = {"user", "model"}


async def chatbot(message: str):
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
                "limit": 5
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
                "score": {"$meta": "vectorSearchScore"}
            }
        }
    ]

    cursor = await anime_collection.aggregate(pipeline)
    results = [doc async for doc in cursor]

    processed_animes = []
    for anime in results:
        processed_anime = await process_anime(anime)
        processed_animes.append(processed_anime)

    context_parts = [
        {
            "role": "user",
            "parts": [
                {
                    "text": (
                        "You are a helpful and friendly assistant designed to suggest animes based on the user's query. "
                        "Your responses should be concise, informative, and engaging. You can suggest animes based on their titles, descriptions, genres, and other relevant attributes. "
                        "You can also provide information about the anime's release date, episode count, and other details that may be helpful for the user. "
                        "Remember to keep your responses short and to the point, and avoid using technical jargon or complex language. "
                        "If you don't have enough information to provide a recommendation, you can suggest that the user look for other anime or provide a general recommendation based on the user's preferences."
                    )
                }
            ],
        }
    ]

    for msg in CONVERSATION_HISTORY[-10:]:
        role = msg["role"]
        if role == "bot":
            role = "model"
        if role not in VALID_ROLES:
            continue

        context_parts.append({
            "role": role,
            "parts": [{"text": msg["message"]}]
        })

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=context_parts
    )

    reply = response.text if response.text else "I'm here to help, but I didn't understand that."

    CONVERSATION_HISTORY.append({"role": "bot", "message": reply})

    if len(CONVERSATION_HISTORY) > 50:
        CONVERSATION_HISTORY.pop(0)

    return reply
