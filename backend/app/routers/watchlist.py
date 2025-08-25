from collections import UserDict
from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime
from typing import List

from app.schemas.watchlist import WatchlistItem, Watchlist, WatchlistResponse, WatchlistAnimeResponseItem
from app.schemas.animes import AnimeStatus 
from app.dependencies import get_database
from app.utils.auth0_security import get_current_user_id

router = APIRouter()


@router.post("/add", response_model=WatchlistResponse)
async def add_to_watchlist(
    anime_id: str,
    user_anime_status: AnimeStatus = AnimeStatus.PLANNED,
    user_id: str = Depends(get_current_user_id),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    watchlist_collection = db.watchlist
    existing = await watchlist_collection.find_one({"user_id": user_id})

    new_item = WatchlistItem(
        anime_id=anime_id,
        watched_at=datetime.utcnow(),
        user_anime_status=user_anime_status
    )

    if existing:
        for item in existing["animes"]:
            if item["anime_id"] == anime_id:
                raise HTTPException(
                    status_code=400, detail="Anime already in watchlist"
                )

        existing["animes"].append(new_item.model_dump())
        existing["updated_at"] = datetime.utcnow()

        await watchlist_collection.update_one(
            {"user_id": user_id},
            {"$set": existing}
        )
        return WatchlistResponse(watchlist=Watchlist(**existing))

    else:
        new_watchlist = Watchlist(
            user_id=user_id,
            animes=[new_item]
        )
        await watchlist_collection.insert_one(new_watchlist.model_dump())
        return WatchlistResponse(watchlist=new_watchlist)


@router.get("/", response_model=List[WatchlistAnimeResponseItem])
async def get_watchlist(user_id: str = Depends(get_current_user_id), db: AsyncIOMotorDatabase = Depends(get_database)):
    watchlist_collection = db.watchlist
    anime_collection = db.animes

    existing = await watchlist_collection.find_one({"user_id": user_id})
    if not existing:
        return [] 

    anime_ids_in_watchlist = [item["anime_id"] for item in existing["animes"]]
    full_animes_cursor = anime_collection.find({"id": {"$in": [int(aid) for aid in anime_ids_in_watchlist]}})
    full_animes_data = await full_animes_cursor.to_list(length=None)

    anime_data_map = {str(anime["id"]): anime for anime in full_animes_data}

    combined_animes_response = []
    for item in existing["animes"]:
        anime_id = item["anime_id"]
        if anime_id in anime_data_map:
            full_anime = anime_data_map[anime_id]
            combined_anime = WatchlistAnimeResponseItem(
                id=full_anime.get("id"),
                title=full_anime.get("title"),
                description=full_anime.get("description"),
                genres=full_anime.get("genres"),
                averageScore=full_anime.get("averageScore"),
                episodes=full_anime.get("episodes"),
                duration=full_anime.get("duration"),
                season=full_anime.get("season"),
                seasonYear=full_anime.get("seasonYear"),
                source=full_anime.get("source"),
                studios=full_anime.get("studios"),
                coverImage=full_anime.get("coverImage"),
                user_anime_status=AnimeStatus(item.get("user_anime_status")) if item.get("user_anime_status") else None, 
                watched_at=item.get("watched_at")
            )
            combined_animes_response.append(combined_anime)

    return combined_animes_response
