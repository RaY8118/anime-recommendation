import random
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.dependencies import get_database
from app.schemas.animes import (
    AVAILABLE_MODELS,
    AnimeListResponse,
    AnimeResponse,
    AnimesListResponse,
    ChatBotRequest,
    ChatBotResponse,
    GenresResponse,
    MessageResponse,
    QueryMode,
)
from app.services.anime_recommendations import (
    retrieve_by_description,
    retrieve_by_genre,
    retrieve_by_name,
)
from app.utils.anime_api import get_anime
from app.utils.anime_embedding_generation import generate_anime_embeddings
from app.utils.fetch_status import get_current_page, update_current_page
from app.utils.langbot import langchain_chatbot
from app.utils.validate_params import validate_query_params

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


@router.post(
    "/fetch", response_model=MessageResponse, status_code=status.HTTP_201_CREATED
)
async def fetch_animes(request: Request, perPage: int = 1):
    perPage = max(1, min(perPage, 10))
    current_page = await get_current_page(request.app, perPage)
    await update_current_page(request.app, perPage, current_page + 1)

    animes = await get_anime(page=current_page)

    if not animes or not animes.get("results"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No animes found",
        )

    return MessageResponse(message="Animes fetched successfully")


@router.post(
    "/generate_embeddings", response_model=MessageResponse, status_code=201
)
async def generate_embeddings(
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    result = await generate_anime_embeddings(db)
    return MessageResponse(message=f"{result['processed']} embeddings generated")


@router.post("/recommend", response_model=AnimeListResponse)
async def recommend_anime(
    query: str = Query(...),
    mode: QueryMode = Query(...),
    top_k: int = Query(5, ge=1, le=50),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    validate_query_params(request=None, required_params={"query", "mode", "top_k"})
    if mode == QueryMode.anime_name:
        results = await retrieve_by_name(query, db, top_k)
    elif mode == QueryMode.genre:
        results = await retrieve_by_genre(query, db, top_k)
    else:
        results = await retrieve_by_description(query, db, top_k)

    if not results:
        raise HTTPException(status_code=404, detail="No similar animes found")

    return AnimeListResponse(results=results)


@router.post("/chatbot", response_model=ChatBotResponse)
async def chatbot(request: ChatBotRequest):
    response = await langchain_chatbot(
        request.message, request.model_id.value, session_id="default"
    )
    return ChatBotResponse(results=response)


@router.get("/models", response_model=list)
async def get_models():
    return AVAILABLE_MODELS


@router.get("/genre", response_model=GenresResponse)
async def get_genres(db: AsyncIOMotorDatabase = Depends(get_database)):
    genres = await db.new_animes.distinct("genres")
    genres = sorted(set([g.strip() for g in genres if g and g.strip()]))
    return GenresResponse(genres=genres)


@router.get("/anime", response_model=AnimesListResponse)
async def get_all_animes(
    page: int = Query(1, ge=1),
    perPage: int = Query(10, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    skip = (page - 1) * perPage
    total = await db.new_animes.count_documents({})
    cursor = db.new_animes.find({}, ANIME_PROJECTION).skip(skip).limit(perPage)
    animes = await cursor.to_list(length=perPage)
    totalPages = (total + perPage - 1) // perPage

    return AnimesListResponse(
        results=animes,
        total=total,
        page=page,
        perPage=perPage,
        totalPages=totalPages,
    )


@router.get("/{anime_id}", response_model=AnimeResponse)
async def get_anime_by_id(anime_id: int, db: AsyncIOMotorDatabase = Depends(get_database)):
    anime = await db.new_animes.find_one({"id": anime_id}, ANIME_PROJECTION)
    if not anime:
        raise HTTPException(status_code=404, detail="Anime not found")
    return AnimeResponse(anime=anime)


@router.get("/", response_model=AnimesListResponse)
async def get_animes(
    search: Optional[str] = Query(None),
    genres: Optional[str] = Query(None),
    season: Optional[str] = Query(None),
    year: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    perPage: int = Query(10, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    query_filter = {}
    if search:
        query_filter["$or"] = [
            {"title.romaji": {"$regex": search, "$options": "i"}},
            {"title.english": {"$regex": search, "$options": "i"}},
        ]
    if genres:
        genre_list = [g.strip() for g in genres.split(",") if g.strip()]
        if genre_list:
            query_filter["genres"] = {"$all": genre_list}
    if season:
        query_filter["season"] = season
    if year:
        query_filter["seasonYear"] = int(year)
    if status:
        query_filter["status"] = status

    skip = (page - 1) * perPage
    total = await db.new_animes.count_documents(query_filter)
    cursor = db.new_animes.find(query_filter, ANIME_PROJECTION).skip(skip).limit(perPage)
    animes = await cursor.to_list(length=perPage)
    totalPages = (total + perPage - 1) // perPage

    return AnimesListResponse(
        results=animes,
        total=total,
        page=page,
        perPage=perPage,
        totalPages=totalPages,
    )
