import os
from collections.abc import AsyncGenerator

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import MongoClient

load_dotenv()
db_uri = os.getenv("MONGODB_URI")
DB_NAME = "anime_recommendation"

_motor_client = None
_sync_mongo_client = None


def get_mongo_client() -> AsyncIOMotorClient:
    global _motor_client
    if _motor_client is None:
        _motor_client = AsyncIOMotorClient(db_uri)
    return _motor_client


def get_sync_mongo_client() -> MongoClient:
    global _sync_mongo_client
    if _sync_mongo_client is None:
        _sync_mongo_client = MongoClient(db_uri)
    return _sync_mongo_client


async def get_database() -> AsyncGenerator[AsyncIOMotorDatabase, None]:
    client = get_mongo_client()
    yield client.get_database("anime_recommendation")
