from pymongo import AsyncMongoClient
import os
from dotenv import load_dotenv

load_dotenv()
db_uri = os.getenv("MONGODB_URI")
client = AsyncMongoClient(db_uri)

db = client.anime_recommendation
