from app.routers import animes, ping, watchlist
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

app = FastAPI()

app.include_router(animes.router, prefix="/v1/animes", tags=["animes"])
app.include_router(ping.router, prefix="/v1/ping", tags=["ping"])
app.include_router(watchlist.router, prefix="/v1/watchlist", tags=["watchlist"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(requests: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"message": str(exc)})
