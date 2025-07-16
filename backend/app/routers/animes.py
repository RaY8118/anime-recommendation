from fastapi import APIRouter
from app.utils.anime_api import get_anime

router = APIRouter()


@router.post("/fetch-animes")
async def fetch_animes(page: int = 1, perPage: int = 1):
    result = await get_anime(page, perPage)
    return result
