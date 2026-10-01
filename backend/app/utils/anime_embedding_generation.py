from app.utils.embeddings import generate_embeddings


async def generate_anime_embeddings(db):
    anime_collection = db.new_animes
    embeddings_collection = db.embeddings

    existing_ids = await embeddings_collection.distinct("anime_id")
    existing_ids = set(existing_ids)

    cursor = anime_collection.find({"id": {"$nin": list(existing_ids)}})

    total = await anime_collection.count_documents({"id": {"$nin": list(existing_ids)}})

    print(f"Found {total} anime without embeddings")

    processed = 0
    failed = 0

    async for anime in cursor:
        anime_id = anime["id"]

        print(f"Generating embedding for anime {anime_id}")

        title = anime.get("title", {})
        title_romaji = title.get("romaji", "")
        title_english = title.get("english", "")

        description = anime.get("description", "")
        genres = anime.get("genres", [])
        genres_text = ", ".join(genres)

        page_content = (
            f"Title: {title_romaji} ({title_english})\n"
            f"Genres: {genres_text}\n"
            f"Description: {description}"
        )

        embedding = await generate_embeddings(page_content)

        if not embedding:
            print(f"FAILED: Could not generate embedding for {anime_id}")
            failed += 1
            continue

        metadata = {
            "id": anime_id,
            "title": title,
            "genres": genres,
            "averageScore": anime.get("averageScore"),
            "episodes": anime.get("episodes"),
            "duration": anime.get("duration"),
            "season": anime.get("season"),
            "seasonYear": anime.get("seasonYear"),
            "status": anime.get("status"),
            "source": anime.get("source"),
            "studios": anime.get("studios", []),
            "coverImage": anime.get("coverImage"),
        }

        await embeddings_collection.update_one(
            {"anime_id": anime_id},
            {
                "$set": {
                    "embedding": embedding,
                    "page_content": page_content,
                    "metadata": metadata,
                }
            },
            upsert=True,
        )

        processed += 1
        print(f"SUCCESS: Generated embedding for {anime_id}")

    print(
        f"Embedding generation finished. " f"Processed: {processed}, Failed: {failed}"
    )
