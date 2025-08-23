from collections import UserDict
from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime

from app.schemas.watchlist import WatchlistItem, Watchlist, WatchlistResponse
from app.dependencies import get_database
from app.utils.auth0_security import get_current_user_id
router = APIRouter()


@router.post("/add", response_model=WatchlistResponse)
async def add_to_watchlist(
    anime_id: str,
    status: str = "planned",
    user_id: str = Depends(get_current_user_id),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    watchlist_collection = db.watchlist
    existing = await watchlist_collection.find_one({"user_id": user_id})

    new_item = WatchlistItem(
        anime_id=anime_id,
        watched_at=datetime.utcnow(),
        status=status
    )

    if existing:
        for item in existing["animes"]:
            if item["anime_id"] == anime_id:
                raise HTTPException(
                    status_code=400, detail="Anime already in watchlist"
                )

        # Convert to dict before saving
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


@router.get("/", response_model=WatchlistResponse)
async def get_watchlist(user_id: str = Depends(get_current_user_id), db: AsyncIOMotorDatabase = Depends(get_database)):
    watchlist_collection = db.watchlist
    existing = await watchlist_collection.find_one({"user_id": user_id})
    if not existing:
        new_watchlist = Watchlist(user_id=user_id, animes=[])
        return WatchlistResponse(watchlist=new_watchlist)

    return WatchlistResponse(watchlist=Watchlist(**existing))
