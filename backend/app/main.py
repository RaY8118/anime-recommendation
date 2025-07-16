from fastapi import FastAPI
from app.routers import animes

app = FastAPI()

app.include_router(animes.router, prefix="/anime")
