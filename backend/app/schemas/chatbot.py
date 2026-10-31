from enum import Enum

from pydantic import BaseModel


class ModelID(str, Enum):
    GEMMA = "google/gemini-2.5-flash-lite"
    FREE_MODELS = "openrouter/free"


AVAILABLE_MODELS = [
    {"id": ModelID.GEMMA, "label": "Gemini flash lite"},
    {"id": ModelID.FREE_MODELS, "label": "Free Router"},
]


class ChatBotRequest(BaseModel):
    message: str
    model_id: ModelID = ModelID.GEMMA
    session_id: str | None = None
    sfw: bool = True


class ChatBotResponse(BaseModel):
    results: str


class ClearChatHistoryRequest(BaseModel):
    session_id: str
