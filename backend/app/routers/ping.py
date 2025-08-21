from fastapi import APIRouter, Depends
from app.utils.auth0_security import get_current_user

router = APIRouter()


@router.get("")
def ping():
    return {"message": "pong"}


@router.get("/private")
def private(user: dict = Depends(get_current_user)):
    return {"message": "Hello from a private endpoint!", "claims": user}
