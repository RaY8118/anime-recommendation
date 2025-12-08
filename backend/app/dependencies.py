import os
from collections.abc import AsyncGenerator

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

load_dotenv()
db_uri = os.getenv("MONGODB_URI")


async def get_database() -> AsyncGenerator[AsyncIOMotorDatabase, None]:
    client = AsyncIOMotorClient(db_uri)
    try:
        yield client.anime_recommendation
    finally:
        client.close()
