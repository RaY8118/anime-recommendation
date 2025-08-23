from fastapi import Depends
from app.dependencies import get_database
from motor.motor_asyncio import AsyncIOMotorDatabase


async def get_current_page(db: AsyncIOMotorDatabase = Depends(get_database)):
    status_collection = db.status
    doc = await status_collection.find_one({})
    if doc:
        return doc.get("current_page", 1)
    else:
        await status_collection.insert_one({
            "_id": "anime_fetch_status",
            "current_page": 1
        })
        return 1


async def update_current_page(page: int, db: AsyncIOMotorDatabase = Depends(get_database)):
    status_collection = db.status
    await status_collection.update_one(
        {"_id": "anime_fetch_status"},
        {"$set": {"current_page": page}},
        upsert=True
    )
