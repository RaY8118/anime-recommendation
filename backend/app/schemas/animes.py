from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum


class Title(BaseModel):
    romaji: Optional[str]
    english: Optional[str]


class CoverImage(BaseModel):
    large: Optional[str]


class Anime(BaseModel):
    id: Optional[int]
    title: Title
    description: Optional[str]
    genres: List[str]
    averageScore: Optional[int] = None
    coverImage: Optional[CoverImage] = None
    embedding: Optional[List[float]] = Field(default_factory=list)

    class Config:
        from_attributes = True


class QueryMode(str, Enum):
    name = "name"
    genre = "genre"
    description = "description"
