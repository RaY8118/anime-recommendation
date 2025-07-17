from fastapi import APIRouter
from app.utils.anime_api import get_anime
from app.utils.embeddings import generate_embeddings
from app.utils.similarity import cosine_similarity
from app.dependencies import db
from app.schemas.animes import QueryMode
from app.utils.fetch_status import get_current_page, update_current_page
router = APIRouter()
anime_collection = db.animes


@router.post("/fetch-animes")
async def fetch_animes(perPage: int = 1):
    page = await get_current_page()

    result = await get_anime(page, perPage)

    if result.get("status") == "success":
        await update_current_page(page + 1)

    return result


@router.post("/recommend")
async def recommend_anime(query: str, mode: QueryMode = QueryMode.description, top_k: int = 5):
    if mode == QueryMode.name:
        anime = await anime_collection.find_one({
            "$or": [
                {"title.romaji": query.lower()},
                {"title.english": query.lower()}
            ]
        })
        if not anime:
            return {"error": "Anime not found"}
        user_embedding = anime.get("embedding")

    elif mode == QueryMode.genre:
        user_embedding = await generate_embeddings(f"Genres: {query}")

    else:
        user_embedding = await generate_embeddings(query)

    animes = anime_collection.find({})
    results = []

    async for anime in animes:
        anime_embedding = anime.get("embedding")
        if anime_embedding:
            score = cosine_similarity(user_embedding, anime_embedding)
            results.append({
                "title": anime['title'],
                "score": score
            })

    results.sort(key=lambda x: x['score'], reverse=True)
    return results[:top_k]
