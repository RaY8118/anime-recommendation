import os
from typing import List, Optional

from langchain_openai import OpenAIEmbeddings

embedding_model = OpenAIEmbeddings(
    model="google/gemini-embedding-001",
    base_url="https://openrouter.ai/api/v1",
    api_key=os.environ.get("OPENROUTER_API_KEY"),
    check_embedding_ctx_length=False,
    extra_body={
        "provider": {
            "order": ["Google Vertex"],
        }
    },
)


async def generate_embeddings(text: str) -> Optional[List[float]]:
    try:
        embedding = embedding_model.embed_query(text)

        if embedding:
            return embedding

        print("No embedding returned.")
        return None

    except Exception as e:
        print("Error generating embedding:", e)
        return None
