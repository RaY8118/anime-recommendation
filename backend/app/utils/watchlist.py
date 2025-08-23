import datetime
from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List

from app.dependencies import get_database
from app.utils.auth0_security import get_current_user_id
from app.schemas.watchlist import WatchlistItem, Watchlist, WatchlistResponse
from app.schemas.animes import AnimeOut, AnimeListResponse


async def add_to_watchlist(anime_id: str, status: str = "planned", db: AsyncIOMotorDatabase = Depends(get_database), user_id: str = Depends(get_current_user_id)) -> dict:
    watchlist_collection = db.watchlist
    new_item = WatchlistItem(
        anime_id=anime_id, watched_at=datetime.datetime.utcnow(), status=status).model_dump
    await watchlist_collection.update_one({"user_id": user_id}, {"$addToSet": {"animes": new_item}, "$set": {"updated_at": datetime.datetime.utcnow()}}, upsert=True)

    return {"message": "Anime added to watchlist", "anime_id": anime_id}


async def get_watchlist(db: AsyncIOMotorDatabase = Depends(get_database), user_id: str = Depends(get_current_user_id)) -> WatchlistResponse:
    watchlist_collection = db.watchlist

    doc = await watchlist_collection.find_one({"user_id": user_id}, {"_id": 0})
    if not doc:
        return WatchlistResponse(watchlist=Watchlist(user_id=user_id, animes=[]))

    return WatchlistResponse(watchlist=Watchlist(**doc))


async def get_watchlist_animes(db: AsyncIOMotorDatabase = Depends(get_database), user_id: str = Depends(get_current_user_id)) -> AnimeListResponse:
    watchlist = await get_watchlist(db, user_id)

    anime_ids = [item.anime_id for item in watchlist.watchlist.animes]
    if not anime_ids:
        return AnimeListResponse(results=[])

    anime_collection = db.animes
    docs = await anime_collection.find({"id": {"$in": anime_ids}}, {"_id": 0}).to_list(length=10)

    animes = [AnimeOut(**doc) for doc in docs]
    return AnimeListResponse(results=animes)
