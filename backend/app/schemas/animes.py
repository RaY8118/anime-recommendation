from pydantic import BaseModel
from typing import List


class Anime(BaseModel):
    id: str
    title: str
    description: str
    genres: List[str]
    average_score: float
    cover_image: str

    class Config:
        orm_mode = True
