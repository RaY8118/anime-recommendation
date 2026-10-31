import os

from app.core.embeddings import embeddings
from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, PayloadSchemaType, VectorParams

COLLECTION_NAME = "anime"
BATCH_SIZE = 200
QDRANT_CLOUD_API_KEY = os.getenv("QDRANT_CLOUD_API_KEY")
QDRANT_CLOUD_ENDPOINT = os.getenv("QDRANT_CLOUD_ENDPOINT")

client = QdrantClient(url=QDRANT_CLOUD_ENDPOINT, api_key=QDRANT_CLOUD_API_KEY)


if not client.collection_exists(COLLECTION_NAME):
    vector_size = len(embeddings.embed_query("test"))

    client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(
            size=vector_size,
            distance=Distance.COSINE,
        ),
    )


PAYLOAD_INDEXES = {
    "metadata.genres": PayloadSchemaType.KEYWORD,
    "metadata.studios": PayloadSchemaType.KEYWORD,
    "metadata.status": PayloadSchemaType.KEYWORD,
    "metadata.season": PayloadSchemaType.KEYWORD,
    "metadata.seasonYear": PayloadSchemaType.INTEGER,
    "metadata.averageScore": PayloadSchemaType.INTEGER,
    "metadata.popularity": PayloadSchemaType.INTEGER,
}

for field_name, field_schema in PAYLOAD_INDEXES.items():
    try:
        client.create_payload_index(
            collection_name=COLLECTION_NAME,
            field_name=field_name,
            field_schema=field_schema,
            wait=False,
        )
    except Exception as exc:
        print(f"Could not create payload index for {field_name}: {exc}")


vector_db = QdrantVectorStore(
    client=client,
    collection_name=COLLECTION_NAME,
    embedding=embeddings,
)
