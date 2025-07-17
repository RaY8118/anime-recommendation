import numpy as np
from google import genai

client = genai.Client()


async def generate_embeddings(text: str):
    try:
        response = client.models.embed_content(
            model="gemini-embedding-001",
            contents=text
        )

        embeddings = response.embeddings[0].values
        return embeddings
    except Exception as e:
        print("Error generating embedding:", e)
        return None
