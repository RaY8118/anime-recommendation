from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.routers import animes, ping

app = FastAPI()

app.include_router(animes.router, prefix="/animes")
app.include_router(ping.router, prefix="/ping")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(requests: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"message": str(exc)}
    )
