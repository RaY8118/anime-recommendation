from typing import List, Optional

from google import genai

client = genai.Client()


async def generate_embeddings(text: str) -> Optional[List[float]]:
    try:
        response = client.models.embed_content(
            model="gemini-embedding-001", contents=text
        )

        if response.embeddings is not None and len(response.embeddings) > 0:
            embeddings = response.embeddings[0].values
            return embeddings
        else:
            print("No embeddings found in response.")
            return None
    except Exception as e:
        print("Error generating embedding:", e)
        return None
