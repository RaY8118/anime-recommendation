from app.core.deps import get_database
from app.core.exceptions import AnimeNotFoundException
from app.schemas.animes import AnimeListResponse
from app.schemas.recommendations import QueryMode
from app.services.anime_recommendations import (
    retrieve_by_description,
    retrieve_by_genre,
    retrieve_by_name,
)
from app.utils.validate_params import validate_query_params
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from motor.motor_asyncio import AsyncIOMotorDatabase

router = APIRouter()


@router.post("/recommendations", response_model=AnimeListResponse)
async def recommend_anime(
    request: Request,
    query: str,
    mode: QueryMode = QueryMode.description,
    top_k: int = 5,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    validate_query_params(request, {"query", "mode", "top_k"})
    if mode == QueryMode.anime_name:
        results = await retrieve_by_name(query, db, top_k)
    elif mode == QueryMode.genre:
        results = await retrieve_by_genre(query, db, top_k)
    else:
        results = await retrieve_by_description(query, db, top_k)

    if not results:
        raise AnimeNotFoundException(detail="No similar animes found")

    return AnimeListResponse(results=results)
