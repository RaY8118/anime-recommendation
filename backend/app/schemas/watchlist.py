from os import wait
from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional
from app.schemas.animes import AnimeOut, AnimeStatus


class WatchlistItem(BaseModel):
    anime_id: str
    watched_at: datetime = Field(default_factory=datetime.utcnow)
    user_anime_status: Optional[AnimeStatus] = None


class Watchlist(BaseModel):
    user_id: str
    animes: List[WatchlistItem] = Field(default_factory=list)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class WatchlistResponse(BaseModel):
    watchlist: Watchlist


class WatchlistAnimeOut(AnimeOut):
    user_anime_status: Optional[AnimeStatus] = None
    watched_at: datetime


class WatchlistAnimeResponseItem(AnimeOut):
    user_anime_status: Optional[AnimeStatus] = None
    watched_at: datetime
