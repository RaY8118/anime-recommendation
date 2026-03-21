from app.routers import animes, ping, watchlist
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import time
import logging
import os

env = os.getenv("ENV", "DEVELOPMENT")
raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
allowed_origins = [origin.strip() for origin in raw_origins.split(",")]

app = FastAPI()

app.include_router(animes.router, prefix="/v1/animes", tags=["animes"])
app.include_router(ping.router, prefix="/v1/ping", tags=["ping"])
app.include_router(watchlist.router, prefix="/v1/watchlist",
                   tags=["watchlist"])

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


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"message": str(exc)})
