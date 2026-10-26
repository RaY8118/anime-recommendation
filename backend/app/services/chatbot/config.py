import os

from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL")
REDIS_HISTORY_TTL = int(os.getenv("REDIS_HISTORY_TTL", "86400"))
HISTORY_SIZE = 20
RETRIEVAL_TOP_K = 8
RETRIEVAL_CANDIDATES = 20
LLM_TIMEOUT_SECONDS = 60
STREAM_TIMEOUT_SECONDS = 120
EXTRACTION_TIMEOUT_SECONDS = 15
RETRIEVAL_TIMEOUT_SECONDS = 25

BASE_RAG_INFO = "Suggest 1-3 animes based EXCLUSIVELY on the provided context data."
RENDER_HINT = "Use simple Markdown: **bold**, *italic*, and basic bullet lists only. Avoid code blocks, tables, or nested structures that may break rendering."

MODEL_SPECIFIC_INSTRUCTIONS = {
    "google/gemini-2.5-flash-lite": (
        f"{
            BASE_RAG_INFO
        } Focus on being fast, concise, and friendly. Use bullet points for readability. {
            RENDER_HINT
        }"
    ),
    "openrouter/free": (
        f"{BASE_RAG_INFO} Be detailed in explanations but keep it concise. Mention why each anime matches the user's preference. {RENDER_HINT}"
    ),
}
DEFAULT_PROMPT = f"{BASE_RAG_INFO} Be a helpful anime assistant. {RENDER_HINT}"

EXTRACTION_INSTRUCTION = (
    "You convert a user's anime request into a structured search. "
    "as 'more like that'). Separately extract any hard constraints the user explicitly "
    "stated or clearly implied: genre, studio, release year range, minimum score, "
    "release status, and season. Only extract constraints that are present; leave "
    "everything else empty or null. Use canonical English names in Title Case for "
    "genres and studios. Do not invent constraints. If the user names no constraint, "
    "    return empty lists and null values."
)
