from fastapi import APIRouter, HTTPException, status, Request
from app.utils.anime_api import get_anime, get_anime_by_name
from app.utils.embeddings import generate_embeddings
from app.utils.similarity import cosine_similarity
from app.utils.validate_params import validate_query_params
from app.dependencies import db
from app.schemas.animes import QueryMode, AnimeListResponse, AnimeResponse, MessageResponse, GenresResponse
from app.utils.fetch_status import get_current_page, update_current_page
import random

router = APIRouter()
anime_collection = db.animes


@router.post("/fetch", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def fetch_animes(request: Request, perPage: int = 1):
    validate_query_params(request, {"perPage"})
    page = await get_current_page()
    result = await get_anime(page, perPage)

    if result.get("status") != "success":
        raise HTTPException(status_code=500, detail=result.get(
            "error") or "Failed to fetch animes")

    await update_current_page(page + 1)
    return {"message": f"{result.get('inserted_ids')} animes inserted successfully"}


@router.post("/recommendations", response_model=AnimeListResponse)
async def recommend_anime(request: Request, query: str, mode: QueryMode = QueryMode.description, top_k: int = 5):
    validate_query_params(request, {"query", "mode", "top_k"})
    if mode == QueryMode.anime_name:
        anime = await anime_collection.find_one({
            "$or": [
                {"title.romaji": query.lower()},
                {"title.english": query.lower()}
            ]
        })
        if not anime:
            raise HTTPException(status_code=404, detail="Anime not found")
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
                "id": anime['id'],
                "title": anime['title'],
                "description": anime['description'],
                "averageScore": anime['averageScore'],
                "genres": anime['genres'],
                "coverImage": anime['coverImage'],
                "score": float(score)
            })

    if not results:
        raise HTTPException(status_code=404, detail="No similar animes found")

    results.sort(key=lambda x: x['score'], reverse=True)

    # Remove score before returning to user
    for anime in results:
        anime.pop("score", None)

    return {"results": results[:top_k]}


@router.get("", response_model=AnimeListResponse)
async def get_animes():
    animes = anime_collection.find({})
    results = []

    async for anime in animes:
        results.append({
            "id": anime['id'],
            "title": anime['title'],
            "description": anime['description'],
            "averageScore": anime['averageScore'],
            "genres": anime['genres'],
            "coverImage": anime['coverImage']
        })

    if not results:
        raise HTTPException(status_code=404, detail="No animes found")

    return {"results": results}


@router.post("/suggestions", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def suggest_anime(anime_name: str):
    if not anime_name:
        raise HTTPException(status_code=400, detail="Anime name is required")

    existing_anime = await anime_collection.find_one({
        "$or": [
            {"title.romaji": anime_name.lower()},
            {"title.english": anime_name.lower()}
        ]
    })

    if existing_anime:
        raise HTTPException(
            status_code=409, detail=f"{anime_name} already exists in the database")

    anime_data = await get_anime_by_name(anime_name)

    if not anime_data:
        raise HTTPException(
            status_code=404, detail="Anime not found on external API")

    await anime_collection.insert_one(anime_data)
    return {"message": f"{anime_name} added to the database"}


@router.get("/genres", response_model=GenresResponse)
async def get_genres():
    genres = await anime_collection.distinct("genres")
    print(genres)
    return {"genres": genres}


@router.get("/search", response_model=AnimeListResponse)
async def search_anime(query: str):
    animes = anime_collection.find({
        "$or": [
            {"title.romaji": {"$regex": query, "$options": "i"}},
            {"title.english": {"$regex": query, "$options": "i"}}
        ]
    })

    results = []
    async for anime in animes:
        results.append({
            "id": anime['id'],
            "title": anime['title'],
            "description": anime['description'],
            "averageScore": anime['averageScore'],
            "genres": anime['genres'],
            "coverImage": anime['coverImage']
        })

    if not results:
        raise HTTPException(status_code=404, detail="No animes found")

    return {"results": results}


@router.get("/filter", response_model=AnimeListResponse)
async def filter_anime_by_genre(genre: str):
    animes = anime_collection.find({
        "genres": {"$in": [genre]}
    })

    results = []

    async for anime in animes:
        results.append({
            "id": anime['id'],
            "title": anime['title'],
            "description": anime['description'],
            "averageScore": anime['averageScore'],
            "genres": anime['genres'],
            "coverImage": anime['coverImage']
        })

    if not results:
        raise HTTPException(
            status_code=404, detail="No animes found for the genre")

    return {"results": results}


@router.get("/random", response_model=AnimeResponse)
async def get_random_anime():
    count = await anime_collection.count_documents({})

    if count == 0:
        raise HTTPException(status_code=404, detail="No animes found")

    random_index = random.randint(0, count - 1)
    anime = await anime_collection.find().skip(random_index).limit(1).to_list(length=1)

    anime = anime[0]
    anime.pop("_id", None)
    anime.pop("embedding", None)

    return {"anime": anime}


@router.get("/top-rated", response_model=AnimeListResponse)
async def top_rated_anime(request: Request, limit: int = 10):
    validate_query_params(request, {"limit"})
    animes = anime_collection.find({}).sort("averageScore", -1).limit(limit)

    results = []

    async for anime in animes:
        results.append({
            "id": anime['id'],
            "title": anime['title'],
            "description": anime['description'],
            "averageScore": anime['averageScore'],
            "genres": anime['genres'],
            "coverImage": anime['coverImage']
        })

    if not results:
        raise HTTPException(status_code=404, detail="No animes found")

    return {"results": results}


@router.get("/{anime_name}", response_model=AnimeResponse)
async def get_anime_by_name_endpoint(anime_name: str):
    anime = await anime_collection.find_one({
        "$or": [
            {"title.romaji": anime_name.lower()},
            {"title.english": anime_name.lower()}
        ]
    })
    if not anime:
        raise HTTPException(status_code=404, detail="Anime not found")

    anime.pop("_id", None)
    anime.pop("embedding", None)

    return {"anime": anime}
