import logging
import os
import time
from collections.abc import AsyncGenerator

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import MongoClient

load_dotenv()
db_uri = os.getenv("MONGODB_URI")
DB_NAME = "anime_recommendation"

# Railway's serverless sleep needs ~10 minutes with no outbound traffic. An
# open PyMongo/Motor client runs a background monitor that pings every Atlas
# node every 10s, so that idle window never starts. Close cached clients once
# the app has stopped using Mongo for a while; the next request re-creates
# them lazily.
MONGO_IDLE_TIMEOUT_SECONDS = float(os.getenv("MONGO_IDLE_TIMEOUT_SECONDS", "120"))

logger = logging.getLogger(__name__)

_motor_client = None
_sync_mongo_client = None
_last_db_activity = time.monotonic()
_active_db_requests = 0


def is_mongo_idle() -> bool:
    """True when no request is using Mongo and it has been quiet for a while."""
    return (
        _active_db_requests == 0
        and time.monotonic() - _last_db_activity >= MONGO_IDLE_TIMEOUT_SECONDS
    )


def get_mongo_client() -> AsyncIOMotorClient:
    global _motor_client
    if _motor_client is None:
        _motor_client = AsyncIOMotorClient(db_uri)
    return _motor_client


def get_sync_mongo_client() -> MongoClient:
    global _sync_mongo_client
    if _sync_mongo_client is None:
        _sync_mongo_client = MongoClient(db_uri, connect=False)
    return _sync_mongo_client


def close_mongo_clients(*, force: bool = False) -> None:
    """Close cached clients, stopping their background monitor threads.

    ``force`` skips the idle check (used at shutdown). The check is repeated
    here so a request that arrives after the watcher's check isn't cut off.
    """
    global _motor_client, _sync_mongo_client

    if not force and not is_mongo_idle():
        return

    if _motor_client is not None:
        _motor_client.close()
        _motor_client = None
        logger.info("Closed idle MongoDB client (background heartbeats stopped)")
    if _sync_mongo_client is not None:
        _sync_mongo_client.close()
        _sync_mongo_client = None


async def get_database() -> AsyncGenerator[AsyncIOMotorDatabase, None]:
    global _last_db_activity, _active_db_requests

    _last_db_activity = time.monotonic()
    _active_db_requests += 1
    try:
        client = get_mongo_client()
        yield client.get_database(DB_NAME)
    finally:
        _active_db_requests -= 1
        _last_db_activity = time.monotonic()
