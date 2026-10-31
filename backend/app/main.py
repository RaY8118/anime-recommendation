import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import get_settings
from app.routers import animes, chatbot, ping, recommendations, watchlist
from app.schemas.chatbot import AVAILABLE_MODELS
from app.services.chatbot import close_checkpointer, setup_checkpointer

settings = get_settings()

env = settings.env
allowed_origins = settings.origins_list


@asynccontextmanager
async def lifespan(_: FastAPI):
    await setup_checkpointer()
    try:
        yield
    finally:
        await close_checkpointer()


app = FastAPI(lifespan=lifespan)


@app.get("/health", tags=["ping"])
def health():
    """Root-level liveness probe (Render/monitoring expect this without the /v1 prefix)."""
    return {"status": "ok"}


@app.get("/v1/models", tags=["chatbot"])
def list_models():
    """Short alias for the chatbot model catalogue (`/v1/animes/chatbot/models`)."""
    return {"models": AVAILABLE_MODELS}


app.include_router(animes.router, prefix="/v1/animes", tags=["animes"])
app.include_router(
    recommendations.router, prefix="/v1/animes", tags=["recommendations"]
)
app.include_router(chatbot.router, prefix="/v1/animes", tags=["chatbot"])
app.include_router(ping.router, prefix="/v1/ping", tags=["ping"])
app.include_router(watchlist.router, prefix="/v1/watchlist", tags=["watchlist"])

logger = logging.getLogger("uvicorn.access")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_request_time(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration = (time.perf_counter() - start) * 1000

    if env == "PRODUCTION":
        logger.info(
            "%s %s → %.2f ms | %s",
            request.method,
            request.url.path,
            duration,
            response.status_code,
        )
    else:
        print(
            f"{request.method} {request.url.path} "
            f"→ {duration:.2f} ms | status={response.status_code}"
        )

    return response


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(status_code=exc.status_code, content={"message": exc.detail})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"message": "Validation error", "details": exc.errors()},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Log the exception here if needed
    return JSONResponse(status_code=500, content={"message": "Internal server error"})
