from enum import Enum

from pydantic import BaseModel, Field

from app.schemas.common import MessageResponse


class AnimeStatus(str, Enum):
    WATCHING = "watching"
    COMPLETED = "completed"
    PLANNED = "planned"
    DROPPED = "dropped"
    PAUSED = "paused"
    FINISHED = "FINISHED"
    RELEASING = "RELEASING"
    CANCELLED = "CANCELLED"
    NOT_YET_RELEASED = "NOT_YET_RELEASED"


class Title(BaseModel):
    romaji: str | None
    english: str | None
    display_romaji: str | None
    display_english: str | None


class CoverImage(BaseModel):
    large: str | None


class Anime(BaseModel):
    id: int | None
    title: Title
    description: str | None
    genres: list[str]
    averageScore: int | None = None
    episodes: int | None = None
    duration: int | None = None
    season: str | None = None
    seasonYear: int | None = None
    status: AnimeStatus | None = None
    source: str | None = None
    studios: list[str] | None = Field(default_factory=list)
    coverImage: CoverImage | None = None
    embedding: list[float] | None = Field(default_factory=list)


class AnimeOut(BaseModel):
    id: int | None
    title: Title
    description: str | None
    genres: list[str]
    averageScore: int | None = None
    episodes: int | None = None
    duration: int | None = None
    season: str | None = None
    seasonYear: int | None = None
    status: AnimeStatus | None = None
    source: str | None = None
    studios: list[str] | None = Field(default_factory=list)
    coverImage: CoverImage | None = None


class AnimeResponse(BaseModel):
    anime: AnimeOut | None


class AnimesListResponse(BaseModel):
    results: list[AnimeOut]
    total: int
    page: int
    perPage: int
    totalPages: int


class AnimeListResponse(BaseModel):
    results: list[AnimeOut]


class GenresResponse(BaseModel):
    genres: list[str]
