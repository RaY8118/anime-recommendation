from app.dependencies import db

status_collection = db.status


async def get_current_page():
    doc = await status_collection.find_one({})
    if doc:
        return doc.get("current_page", 1)
    else:
        await status_collection.insert_one({
            "_id": "anime_fetch_status",
            "current_page": 1
        })
        return 1


async def update_current_page(page: int):
    await status_collection.update_one(
        {"_id": "anime_fetch_status"},
        {"$set": {"current_page": page}},
        upsert=True
    )
