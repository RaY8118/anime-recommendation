from os import wait
from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional


class WatchlistItem(BaseModel):
    anime_id: str
    watched_at: datetime = Field(default_factory=datetime.utcnow)
    status: Optional[str] = None


class Watchlist(BaseModel):
    user_id: str
    animes: List[WatchlistItem] = Field(default_factory=list)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class WatchlistResponse(BaseModel):
    watchlist: Watchlist
