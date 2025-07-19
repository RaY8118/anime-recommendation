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


class AnimeOut(BaseModel):
    id: Optional[int]
    title: Title
    description: Optional[str]
    genres: List[str]
    averageScore: Optional[int] = None
    coverImage: Optional[CoverImage] = None


class AnimeResponse(BaseModel):
    anime: Optional[AnimeOut]


class AnimeListResponse(BaseModel):
    results: List[AnimeOut]


class GenresResponse(BaseModel):
    genres: List[str]


class MessageResponse(BaseModel):
    message: Optional[str]


class QueryMode(str, Enum):
    anime_name = "anime_name"
    genre = "genre"
    description = "description"
