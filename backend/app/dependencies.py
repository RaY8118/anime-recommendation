from pymongo import AsyncMongoClient
import os
from dotenv import load_dotenv

load_dotenv()
db_uri = os.getenv("MONGODB_URI")
print(db_uri)
client = AsyncMongoClient(db_uri)

db = client.anime_recommendation
