import httpx
from app.dependencies import db

anime_collection = db.animes
url = "https://graphql.anilist.co"

# Define GraphQL query
query = '''
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
      coverImage {
        large
      }
    }
  }
}
'''


async def get_anime(page: int = 1, perPage: int = 1):

    # Variables for pagination
    variables = {
        'page': page,
        'perPage': perPage
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json={'query': query, 'variables': variables})

        if response.status_code == 200:
            data = response.json()

            inserted = []
            for anime in data['data']['Page']['media']:
                result = await anime_collection.insert_one(anime)
                inserted.append(str(result.inserted_id))

            return {"status": "success", "inserted_ids": inserted}

        else:
            return {"status": "error", "code": response.status_code, "message": "Failed to fetch anime data"}
    except Exception as e:
        raise e
