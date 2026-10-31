import os

from langchain_openai import OpenAIEmbeddings

embeddings = OpenAIEmbeddings(
    model="baai/bge-m3",
    base_url="https://openrouter.ai/api/v1",
    api_key=os.environ.get("OPENROUTER_API_KEY"),
    check_embedding_ctx_length=False,
)


async def generate_embeddings(text: str) -> list[float] | None:
    try:
        embedding = embeddings.embed_query(text)

        if embedding:
            return embedding

        print("No embedding returned.")
        return None

    except Exception as e:
        print("Error generating embedding:", e)
        return None
