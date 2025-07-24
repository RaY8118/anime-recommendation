from fastapi import APIRouter

router = APIRouter()


@router.get("", status_code=200)
async def ping():
    return {"status": "ok"}
