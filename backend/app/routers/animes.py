import random

from app.core.deps import get_database
from app.schemas.animes import (
    AnimeListResponse,
    AnimeResponse,
    AnimesListResponse,
    GenresResponse,
    MessageResponse,
)
from app.utils.anime_api import get_anime
from app.utils.anime_embedding_generation import generate_anime_embeddings
from app.utils.fetch_status import get_current_page, update_current_page
from app.utils.validate_params import validate_query_params
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from motor.motor_asyncio import AsyncIOMotorDatabase

router = APIRouter()

ANIME_PROJECTION = {
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
}


@router.get("", response_model=AnimesListResponse)
async def get_animes(
    page: int = Query(1, ge=1),
    per_page: int = Query(12, ge=1, le=100),
    genre: str | None = Query(None),
    min_score: int | None = Query(None),
    max_score: int | None = Query(None),
    season: str | None = Query(None),
    year: int | None = Query(None),
    query: str | None = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    skip = (page - 1) * per_page
    anime_collection = db.new_animes

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
    cursor = (
        anime_collection.find(mongo_query, ANIME_PROJECTION).skip(skip).limit(per_page)
    )

    results = [anime async for anime in cursor]

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


@router.post(
    "/suggestions", response_model=MessageResponse, status_code=status.HTTP_201_CREATED
)
async def suggest_anime(
    anime_name: str, db: AsyncIOMotorDatabase = Depends(get_database)
):
    if not anime_name:
        raise BadRequestException(detail="Anime name is required")
    anime_collection = db.new_animes
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
    anime_collection = db.new_animes
    genres = await anime_collection.distinct("genres")
    return {"genres": genres}


@router.get("/search", response_model=AnimeListResponse)
async def search_anime(query: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    anime_collection = db.new_animes
    # Optimization: Use indexed search if available, and projection to limit fields
    cursor = anime_collection.find(
        {
            "$or": [
                {
                    "title.romaji": {"$regex": f"^{query}", "$options": "i"}
                },  # Prefix search is faster than general regex
                {"title.english": {"$regex": f"^{query}", "$options": "i"}},
            ]
        },
        ANIME_PROJECTION,
    ).limit(
        20
    )  # Limit search results for performance

    results = [anime async for anime in cursor]

    if not results:
        raise AnimeNotFoundException(detail="No animes found")

    return {"results": results}


@router.get("/filter", response_model=AnimeListResponse)
async def filter_anime_by_genre(
    genre: str,
    limit: int = 10,
    page: int = 1,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    skip = (page - 1) * limit
    anime_collection = db.new_animes
    cursor = (
        anime_collection.find(
            {"genres": {"$elemMatch": {"$regex": f"^{genre}$", "$options": "i"}}},
            ANIME_PROJECTION,
        )
        .skip(skip)
        .limit(limit)
    )

    results = [anime async for anime in cursor]

    if not results:
        raise AnimeNotFoundException(detail="No animes found for the genre")

    return {"results": results}


@router.get("/random", response_model=AnimeResponse)
async def get_random_anime(db: AsyncIOMotorDatabase = Depends(get_database)):
    anime_collection = db.new_animes
    count = await anime_collection.count_documents({})

    if count == 0:
        raise AnimeNotFoundException(detail="No animes found")

    random_index = random.randint(0, count - 1)
    anime = (
        await anime_collection.find({}, ANIME_PROJECTION)
        .skip(random_index)
        .limit(1)
        .to_list(length=1)
    )

    return {"anime": anime[0]}


@router.get("/top-rated", response_model=AnimeListResponse)
async def top_rated_anime(
    request: Request, limit: int = 10, db: AsyncIOMotorDatabase = Depends(get_database)
):
    validate_query_params(request, {"limit"})
    anime_collection = db.new_animes
    cursor = (
        anime_collection.find({}, ANIME_PROJECTION)
        .sort("averageScore", -1)
        .limit(limit)
    )

    results = [anime async for anime in cursor]

    if not results:
        raise AnimeNotFoundException(detail="No animes found")

    return {"results": results}


@router.get("/generate-embeddings")
async def create_embeddings(
    force: bool = False,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    result = await generate_anime_embeddings(db, force=force)

    return {"message": "Embedding generation completed", **result}


@router.get("/{id}", response_model=AnimeResponse)
async def get_anime_by_id(id: int, db: AsyncIOMotorDatabase = Depends(get_database)):
    anime_collection = db.new_animes
    anime = await anime_collection.find_one({"id": id})
    if not anime:
        raise AnimeNotFoundException(detail="Anime not found")

    anime.pop("_id", None)
    anime.pop("embedding", None)

    return {"anime": anime}
