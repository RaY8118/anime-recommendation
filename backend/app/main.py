from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from app.routers import animes

app = FastAPI()

app.include_router(animes.router, prefix="/animes")


@app.exception_handler(Exception)
async def global_exception_handler(requests: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"message": str(exc)}
    )
