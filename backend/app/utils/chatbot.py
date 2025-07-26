from app.utils.embeddings import generate_embeddings
from app.utils.similarity import cosine_similarity
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
    animes = anime_collection.find({})
    results = []

    async for anime in animes:
        anime_embedding = anime.get("embedding")
        if anime_embedding:
            score = cosine_similarity(message_embedding, anime_embedding)
            results.append({
                "id": anime['id'],
                "title": anime['title'],
                "description": anime['description'],
                "averageScore": anime['averageScore'],
                "genres": anime['genres'],
                "episodes": anime['episodes'],
                "duration": anime['duration'],
                "season": anime['season'],
                "seasonYear": anime['seasonYear'],
                "status": anime['status'],
                "source": anime['source'],
                "studios": anime['studios'],
                "coverImage": anime['coverImage'],
                "score": float(score)
            })

    if results:
        results.sort(key=lambda x: x['score'], reverse=True)
        results = results[:5]

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

    reply = response.text if response.text else "I'm here to help, but I didn’t understand that."

    CONVERSATION_HISTORY.append({"role": "bot", "message": reply})

    if len(CONVERSATION_HISTORY) > 50:
        CONVERSATION_HISTORY.pop(0)

    return reply
