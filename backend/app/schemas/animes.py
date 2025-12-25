from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class AnimeStatus(str, Enum):
    WATCHING = "watching"
    COMPLETED = "completed"
    PLANNED = "planned"
    DROPPED = "dropped"
    PAUSED = "paused"
    FINISHED = "FINISHED"
    RELEASING = "RELEASING"


class Title(BaseModel):
    romaji: Optional[str]
    english: Optional[str]
    display_romaji: Optional[str]
    display_english: Optional[str]


class CoverImage(BaseModel):
    large: Optional[str]


class Anime(BaseModel):
    id: Optional[int]
    title: Title
    description: Optional[str]
    genres: List[str]
    averageScore: Optional[int] = None
    episodes: Optional[int] = None
    duration: Optional[int] = None
    season: Optional[str] = None
    seasonYear: Optional[int] = None
    status: Optional[AnimeStatus] = None
    source: Optional[str] = None
    studios: Optional[List[str]] = Field(default_factory=list)
    coverImage: Optional[CoverImage] = None
    embedding: Optional[List[float]] = Field(default_factory=list)


class AnimeOut(BaseModel):
    id: Optional[int]
    title: Title
    description: Optional[str]
    genres: List[str]
    averageScore: Optional[int] = None
    episodes: Optional[int] = None
    duration: Optional[int] = None
    season: Optional[str] = None
    seasonYear: Optional[int] = None
    status: Optional[AnimeStatus] = None
    source: Optional[str] = None
    studios: Optional[List[str]] = Field(default_factory=list)
    coverImage: Optional[CoverImage] = None


class AnimeResponse(BaseModel):
    anime: Optional[AnimeOut]


class AnimesListResponse(BaseModel):
    results: List[AnimeOut]
    total: int
    page: int
    perPage: int
    totalPages: int


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


class ModelID(str, Enum):
    MISTRAL = "mistralai/devstral-2512:free"
    GPT_OSS = "openai/gpt-oss-20b:free"
    LLAMA = "meta-llama/llama-3.3-70b-instruct:free"


AVAILABLE_MODELS = [
    {"id": ModelID.MISTRAL, "label": "MistralAI (Fast)"},
    {"id": ModelID.GPT_OSS, "label": "GPT-OSS (Creative)"},
    {"id": ModelID.LLAMA, "label": "Llama 3.3 (Smart)"},
]


class ChatBotRequest(BaseModel):
    message: str
    model_id: ModelID = ModelID.MISTRAL


class ChatBotResponse(BaseModel):
    results: str
