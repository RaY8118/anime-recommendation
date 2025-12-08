import asyncio

import httpx
from app.dependencies import get_database
from app.schemas.animes import Anime
from app.utils.clean_text import clean_html
from app.utils.embeddings import generate_embeddings
from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

url = "https://graphql.anilist.co"


async def get_anime(
    page: int = 1, perPage: int = 1, db: AsyncIOMotorDatabase = Depends(get_database)
):
    anime_collection = db.animes
    query = """
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(type: ANIME, sort: POPULARITY_DESC) {
          id
          title {
            romaji
            english
          }
          description
          genres
          averageScore
          episodes
          duration
          season
          seasonYear
          status
          source
          studios {
            nodes {
              name
            }
          }
          coverImage {
            large
          }
        }
      }
    }
    """
    variables = {"page": page, "perPage": perPage}

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                url, json={"query": query, "variables": variables}
            )

        if response.status_code == 200:
            data = response.json()
            animes = data["data"]["Page"]["media"]

            tasks = [process_anime(anime) for anime in animes]
            processed_anime = await asyncio.gather(*tasks)

            validated_anime = []

            for anime in processed_anime:
                anime["title"]["display_romaji"] = anime["title"]["romaji"]
                anime["title"]["display_english"] = anime["title"]["english"]

                anime["title"]["romaji"] = (
                    anime["title"]["romaji"].lower()
                    if anime["title"]["romaji"]
                    else None
                )
                anime["title"]["english"] = (
                    anime["title"]["english"].lower()
                    if anime["title"]["english"]
                    else None
                )

                if "description" in anime and anime["description"]:
                    anime["description"] = clean_html(anime["description"])

                validated_anime.append(Anime(**anime).model_dump())

            await anime_collection.insert_many(validated_anime)

            return {"status": "success", "inserted_ids": len(validated_anime)}

        else:
            return {
                "status": "error",
                "code": response.status_code,
                "message": "Failed to fetch anime data",
            }
    except Exception as e:
        raise e


async def get_anime_by_name(name: str):
    query = """
    query ($search: String) {
      Media(search: $search, type: ANIME) {
        id
        title {
          romaji
          english
        }
        description
        genres
        averageScore
        episodes
        duration
        season
        seasonYear
        status
        source
        studios {
          nodes {
            name
          }
        }
        coverImage {
          large
        }
      }
    }
    """

    variables = {"search": name}

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                url, json={"query": query, "variables": variables}
            )

        if response.status_code == 200:
            data = response.json()
            anime = data.get("data", {}).get("Media")
            if anime:
                processed = await process_anime(anime)

                processed["title"]["display_romaji"] = processed["title"]["romaji"]
                processed["title"]["display_english"] = processed["title"]["english"]

                processed["title"]["romaji"] = (
                    processed["title"]["romaji"].lower()
                    if processed["title"]["romaji"]
                    else None
                )
                processed["title"]["english"] = (
                    processed["title"]["english"].lower()
                    if processed["title"]["english"]
                    else None
                )

                # Generate embedding for description
                processed["embedding"] = await generate_embeddings(
                    processed["description"]
                )
                return processed
        return None

    except Exception as e:
        print("Error fetching anime by name:", e)
        return None


async def process_anime(anime):
    title_romaji: str = anime["title"].get("romaji", "")
    title_english = anime["title"].get("english", "")
    description_text = clean_html(anime.get("description", ""))
    genres = anime.get("genres", [])
    genres_text = ", ".join(genres)

    anime["episodes"] = anime.get("episodes")
    anime["duration"] = anime.get("duration")
    anime["season"] = anime.get("season")
    anime["seasonYear"] = anime.get("seasonYear")
    anime["status"] = anime.get("status")
    anime["source"] = anime.get("source")

    studios_raw = anime.get("studios", [])
    if isinstance(studios_raw, dict):
        anime["studios"] = [studio["name"] for studio in studios_raw.get("nodes", [])]
    elif isinstance(studios_raw, list):
        anime["studios"] = [
            studio["name"] for studio in studios_raw if "name" in studio
        ]
    else:
        anime["studios"] = []

    final_text = f"Title: {title_romaji} ({title_english})\nDescription: {description_text}\nGenres: {genres_text}"

    embedding = await generate_embeddings(final_text)
    anime["embedding"] = embedding if embedding else []
    return anime
