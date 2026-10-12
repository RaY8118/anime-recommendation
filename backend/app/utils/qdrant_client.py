import os

from langchain_community.embeddings.fastembed import FastEmbedEmbeddings
from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams

COLLECTION_NAME = "anime"
BATCH_SIZE = 200
VECTOR_SIZE = 512
QDRANT_CLOUD_API_KEY = os.getenv("QDRANT_CLOUD_API_KEY")
QDRANT_CLOUD_ENDPOINT = os.getenv("QDRANT_CLOUD_ENDPOINT")

client = QdrantClient(url=QDRANT_CLOUD_ENDPOINT, api_key=QDRANT_CLOUD_API_KEY)

embeddings = FastEmbedEmbeddings(model_name="BAAI/bge-small-zh-v1.5")

if not client.collection_exists(COLLECTION_NAME):
    client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(
            size=VECTOR_SIZE,
            distance=Distance.COSINE,
        ),
    )

vector_db = QdrantVectorStore(
    client=client,
    collection_name=COLLECTION_NAME,
    embedding=embeddings,
)
