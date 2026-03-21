import os
from collections.abc import AsyncGenerator

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

load_dotenv()
db_uri = os.getenv("MONGODB_URI")

# Global client for connection pooling
_mongo_client = None

def get_mongo_client():
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = AsyncIOMotorClient(db_uri)
    return _mongo_client

async def get_database() -> AsyncGenerator[AsyncIOMotorDatabase, None]:
    client = get_mongo_client()
    # Yield the database without closing the client
    yield client.get_database("anime_recommendation")
