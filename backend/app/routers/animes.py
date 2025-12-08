import random
from typing import Optional

import numpy as np
from app.dependencies import get_database
from app.schemas.animes import (
    AnimeListResponse,
    AnimeResponse,
    AnimesListResponse,
    ChatBotRequest,
    ChatBotResponse,
    GenresResponse,
    MessageResponse,
    QueryMode,
)
from app.utils.anime_api import get_anime
from app.utils.chatbot import chatbot
from app.utils.embeddings import generate_embeddings
from app.utils.fetch_status import get_current_page, update_current_page
from app.utils.validate_params import validate_query_params
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from google import genai
from motor.motor_asyncio import AsyncIOMotorDatabase

router = APIRouter()


@router.post(
    "/fetch", response_model=MessageResponse, status_code=status.HTTP_201_CREATED
)
async def fetch_animes(request: Request, perPage: int = 1):
    validate_query_params(request, {"perPage"})
    page = await get_current_page()
    result = await get_anime(page, perPage)

    if result.get("status") != "success":
        raise HTTPException(
            status_code=500, detail=result.get("error") or "Failed to fetch animes"
        )

    await update_current_page(page + 1)
    return {"message": f"{result.get('inserted_ids')} animes inserted successfully"}


@router.post("/recommendations", response_model=AnimeListResponse)
async def recommend_anime(
    request: Request,
    query: str,
    mode: QueryMode = QueryMode.description,
    top_k: int = 5,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    validate_query_params(request, {"query", "mode", "top_k"})
    anime_collection = db.animes

    if mode == QueryMode.anime_name:
        anime = await anime_collection.find_one(
            {"$or": [{"title.romaji": query.lower()}, {"title.english": query.lower()}]}
        )
        if not anime:
            raise HTTPException(status_code=404, detail="Anime not found")
        user_embedding = anime.get("embedding")

    elif mode == QueryMode.genre:
        user_embedding = await generate_embeddings(f"Genres: {query}")
    else:
        user_embedding = await generate_embeddings(query)

    if isinstance(user_embedding, np.ndarray):
        user_embedding = user_embedding.tolist()

    pipeline = [
        {
            "$vectorSearch": {
                "index": "embeddings_vector_index",
                "path": "embedding",
                "queryVector": user_embedding,
                "numCandidates": 100,
                "limit": top_k,
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

    if not results:
        raise HTTPException(status_code=404, detail="No similar animes found")

    return {"results": results}


@router.get("", response_model=AnimesListResponse)
async def get_animes(
    page: int = Query(1, ge=1),
    per_page: int = Query(12, ge=1, le=100),
    genre: Optional[str] = Query(None),
    min_score: Optional[int] = Query(None),
    max_score: Optional[int] = Query(None),
    season: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    query: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    skip = (page - 1) * per_page
    anime_collection = db.animes

    mongo_query = {}

    if genre:
        mongo_query["genres"] = genre

    if min_score or max_score:
        mongo_query["averageScore"] = {}
        if min_score:
            mongo_query["averageScore"]["$gte"] = min_score
        if max_score:
            mongo_query["averageScore"]["$lte"] = max_score

    if season:
        mongo_query["season"] = season.upper()

    if year:
        mongo_query["seasonYear"] = year

    if query:
        mongo_query["$or"] = [
            {"title.romaji": {"$regex": query, "$options": "i"}},
            {"title.english": {"$regex": query, "$options": "i"}},
        ]

    total = await anime_collection.count_documents(mongo_query)
    cursor = anime_collection.find(mongo_query).skip(skip).limit(per_page)

    results = []
    async for anime in cursor:
        results.append(
            {
                "id": anime["id"],
                "title": anime["title"],
                "description": anime["description"],
                "averageScore": anime["averageScore"],
                "genres": anime["genres"],
                "episodes": anime["episodes"],
                "duration": anime["duration"],
                "season": anime["season"],
                "seasonYear": anime["seasonYear"],
                "status": anime["status"],
                "source": anime["source"],
                "studios": anime["studios"],
                "coverImage": anime["coverImage"],
            }
        )

    if not results:
        return {
            "results": [],
            "total": 0,
            "page": page,
            "perPage": per_page,
            "totalPages": 0,
        }

    return {
        "results": results,
        "total": total,
        "page": page,
        "perPage": per_page,
        "totalPages": (total + per_page - 1),
    }


@router.post(
    "/suggestions", response_model=MessageResponse, status_code=status.HTTP_201_CREATED
)
async def suggest_anime(
    anime_name: str, db: AsyncIOMotorDatabase = Depends(get_database)
):
    if not anime_name:
        raise HTTPException(status_code=400, detail="Anime name is required")
    anime_collection = db.animes
    suggestions_collection = db.suggestions

    existing_anime = await anime_collection.find_one(
        {
            "$or": [
                {"title.romaji": anime_name.lower()},
                {"title.english": anime_name.lower()},
            ]
        }
    )

    if existing_anime:
        raise HTTPException(
            status_code=409, detail=f"{anime_name} already exists in the database"
        )

    await suggestions_collection.insert_one(anime_name)
    return {"message": f"{anime_name} added to the database"}


@router.get("/genres", response_model=GenresResponse)
async def get_genres(db: AsyncIOMotorDatabase = Depends(get_database)):
    anime_collection = db.animes
    genres = await anime_collection.distinct("genres")
    return {"genres": genres}


@router.get("/search", response_model=AnimeListResponse)
async def search_anime(query: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    anime_collection = db.animes
    animes = anime_collection.find(
        {
            "$or": [
                {"title.romaji": {"$regex": query, "$options": "i"}},
                {"title.english": {"$regex": query, "$options": "i"}},
            ]
        }
    )

    results = []
    async for anime in animes:
        results.append(
            {
                "id": anime["id"],
                "title": anime["title"],
                "description": anime["description"],
                "averageScore": anime["averageScore"],
                "genres": anime["genres"],
                "episodes": anime["episodes"],
                "duration": anime["duration"],
                "season": anime["season"],
                "seasonYear": anime["seasonYear"],
                "status": anime["status"],
                "source": anime["source"],
                "studios": anime["studios"],
                "coverImage": anime["coverImage"],
            }
        )

    if not results:
        raise HTTPException(status_code=404, detail="No animes found")

    return {"results": results}


@router.get("/filter", response_model=AnimeListResponse)
async def filter_anime_by_genre(
    genre: str,
    limit: int = 10,
    page: int = 1,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    skip = (page - 1) * limit
    anime_collection = db.animes
    animes = (
        anime_collection.find(
            {"genres": {"$elemMatch": {"$regex": f"^{genre}$", "$options": "i"}}}
        )
        .skip(skip)
        .limit(limit)
    )

    results = []

    async for anime in animes:
        results.append(
            {
                "id": anime["id"],
                "title": anime["title"],
                "description": anime["description"],
                "averageScore": anime["averageScore"],
                "genres": anime["genres"],
                "episodes": anime["episodes"],
                "duration": anime["duration"],
                "season": anime["season"],
                "seasonYear": anime["seasonYear"],
                "status": anime["status"],
                "source": anime["source"],
                "studios": anime["studios"],
                "coverImage": anime["coverImage"],
            }
        )

    if not results:
        raise HTTPException(status_code=404, detail="No animes found for the genre")

    return {"results": results}


@router.get("/random", response_model=AnimeResponse)
async def get_random_anime(db: AsyncIOMotorDatabase = Depends(get_database)):
    anime_collection = db.animes
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
async def top_rated_anime(
    request: Request, limit: int = 10, db: AsyncIOMotorDatabase = Depends(get_database)
):
    validate_query_params(request, {"limit"})
    anime_collection = db.animes
    animes = anime_collection.find({}).sort("averageScore", -1).limit(limit)

    results = []

    async for anime in animes:
        results.append(
            {
                "id": anime["id"],
                "title": anime["title"],
                "description": anime["description"],
                "averageScore": anime["averageScore"],
                "genres": anime["genres"],
                "episodes": anime["episodes"],
                "duration": anime["duration"],
                "season": anime["season"],
                "seasonYear": anime["seasonYear"],
                "status": anime["status"],
                "source": anime["source"],
                "studios": anime["studios"],
                "coverImage": anime["coverImage"],
            }
        )

    if not results:
        raise HTTPException(status_code=404, detail="No animes found")

    return {"results": results}


@router.get("/{anime_name}", response_model=AnimeResponse)
async def get_anime_by_name_endpoint(
    anime_name: str, db: AsyncIOMotorDatabase = Depends(get_database)
):
    anime_collection = db.animes
    anime = await anime_collection.find_one(
        {
            "$or": [
                {"title.romaji": anime_name.lower()},
                {"title.english": anime_name.lower()},
            ]
        }
    )
    if not anime:
        raise HTTPException(status_code=404, detail="Anime not found")

    anime.pop("_id", None)
    anime.pop("embedding", None)

    return {"anime": anime}


@router.post("/chatbot", response_model=ChatBotResponse)
async def Chatbot(
    request: ChatBotRequest, db: AsyncIOMotorDatabase = Depends(get_database)
):
    results = await chatbot(request.message, db)
    if not results:
        raise HTTPException(status_code=404, detail="No results found")
    return {"results": results}
