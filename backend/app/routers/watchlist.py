from datetime import datetime
from typing import List, Optional

from app.dependencies import get_database
from app.schemas.animes import AnimeStatus
from app.schemas.watchlist import (
    Watchlist,
    WatchlistAnimeResponseItem,
    WatchlistItem,
    WatchlistResponse,
)
from app.utils.auth0_security import get_current_user_id
from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

router = APIRouter()


@router.post("/add", response_model=WatchlistResponse)
async def add_to_watchlist(
    anime_id: str,
    user_anime_status: AnimeStatus = AnimeStatus.PLANNED,
    user_id: str = Depends(get_current_user_id),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    watchlist_collection = db.watchlist
    existing = await watchlist_collection.find_one({"user_id": user_id})

    new_item = WatchlistItem(
        anime_id=anime_id,
        watched_at=datetime.utcnow(),
        user_anime_status=user_anime_status,
    )

    if existing:
        for item in existing["animes"]:
            if item["anime_id"] == anime_id:
                raise HTTPException(
                    status_code=400, detail="Anime already in watchlist"
                )

        existing["animes"].append(new_item.model_dump())
        existing["updated_at"] = datetime.utcnow()

        await watchlist_collection.update_one({"user_id": user_id}, {"$set": existing})
        return WatchlistResponse(watchlist=Watchlist(**existing))

    else:
        new_watchlist = Watchlist(user_id=user_id, animes=[new_item])
        await watchlist_collection.insert_one(new_watchlist.model_dump())
        return WatchlistResponse(watchlist=new_watchlist)


@router.get("/", response_model=List[WatchlistAnimeResponseItem])
async def get_watchlist(
    user_id: str = Depends(get_current_user_id),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    watchlist_collection = db.watchlist
    anime_collection = db.animes

    existing = await watchlist_collection.find_one({"user_id": user_id})
    if not existing:
        return []

    anime_ids_in_watchlist = [item["anime_id"] for item in existing["animes"]]
    full_animes_cursor = anime_collection.find(
        {"id": {"$in": [int(aid) for aid in anime_ids_in_watchlist]}}
    )
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
                user_anime_status=(
                    AnimeStatus(item.get("user_anime_status"))
                    if item.get("user_anime_status")
                    else None
                ),
                watched_at=item.get("watched_at"),
            )
            combined_animes_response.append(combined_anime)

    return combined_animes_response


@router.get("/{anime_id}", response_model=Optional[WatchlistAnimeResponseItem])
async def get_watchlist_item(
    anime_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    watchlist_collection = db.watchlist
    anime_collection = db.animes

    existing = await watchlist_collection.find_one({"user_id": user_id})
    if not existing:
        return None

    # find this anime in the user's list
    for item in existing["animes"]:
        if item["anime_id"] == anime_id:
            # fetch full anime data
            full_anime = await anime_collection.find_one({"id": int(anime_id)})
            if not full_anime:
                return None

            return WatchlistAnimeResponseItem(
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
                user_anime_status=(
                    AnimeStatus(item.get("user_anime_status"))
                    if item.get("user_anime_status")
                    else None
                ),
                watched_at=item.get("watched_at"),
            )

    return None


@router.delete("/{anime_id}", response_model=WatchlistResponse)
async def delete_from_watchlist(
    anime_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    watchlist_collection = db.watchlist

    existing = await watchlist_collection.find_one({"user_id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Watchlist not found")

    update_animes = [a for a in existing["animes"] if a["anime_id"] != anime_id]
    if len(update_animes) == len(existing["animes"]):
        raise HTTPException(status_code=404, detail="Anime not found in watchlist")

    existing["animes"] = update_animes
    existing["updated_at"] = datetime.utcnow()

    await watchlist_collection.update_one({"user_id": user_id}, {"$set": existing})

    return WatchlistResponse(watchlist=Watchlist(**existing))


@router.put("/{anime_id}", response_model=WatchlistResponse)
async def update_watchlist_item(
    anime_id: str,
    new_status: AnimeStatus,
    user_id: str = Depends(get_current_user_id),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    watchlist_collection = db.watchlist
    existing = await watchlist_collection.find_one({"user_id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Watchlist not found")

    updated = False
    for item in existing["animes"]:
        if item["anime_id"] == anime_id:
            item["user_anime_status"] = new_status
            updated = True
            break

    if not updated:
        raise HTTPException(status_code=404, detail="Anime not found in watchlist")

    existing["updated_at"] = datetime.utcnow()

    await watchlist_collection.update_one({"user_id": user_id}, {"$set": existing})

    return WatchlistResponse(watchlist=Watchlist(**existing))
