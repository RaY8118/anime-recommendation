from anime.v1 import ingest_pb2

from app.core.text import clean_html


def anime_request_to_document(request: ingest_pb2.IngestAnimeRequest) -> dict:
    """Map one proto request to a dict validating cleanly through Anime.

    Proto fields are snake_case; Mongo keys stay camelCase (averageScore,
    seasonYear, coverImage) — that key style is the cross-service contract,
    not something the proto should leak into the database.
    """
    title = request.title

    romaji = title.title_romaji if title.HasField("title_romaji") else None
    english = title.title_english if title.HasField("title_english") else None

    document = {
        "id": request.id,
        "title": {
            "romaji": _searchable(romaji),
            "english": _searchable(english),
            "display_romaji": romaji,
            "display_english": english,
        },
        "description": (
            clean_html(request.description) if request.HasField("description") else None
        ),
        "genres": list(request.genres),
        "averageScore": _optional_int32(
            request.average_score, request.HasField("average_score")
        ),
        "episodes": _optional_int32(request.episodes, request.HasField("episodes")),
        "duration": _optional_int32(request.duration, request.HasField("duration")),
        "chapters": _optional_int32(request.chapters, request.HasField("chapters")),
        "volumes": _optional_int32(request.volumes, request.HasField("volumes")),
        "season": _optional_str(request.season, request.HasField("season")),
        "seasonYear": _optional_int32(
            request.season_year, request.HasField("season_year")
        ),
        "status": _optional_str(request.status, request.HasField("status")),
        "source": _optional_str(request.source, request.HasField("source")),
        "studios": list(request.studios),
        "coverImage": (
            {"large": request.cover_image.large}
            if request.HasField("cover_image") and request.cover_image.HasField("large")
            else None
        ),
        "isAdult": request.is_adult if request.HasField("is_adult") else None,
        "popularity": request.popularity,
    }

    return document


def _searchable(value: str | None) -> str | None:
    """Lower-cased search form; empty or absent maps to None (never '')."""
    if not value:
        return None
    return value.lower()


def _optional_str(value: str, present: bool) -> str | None:
    return value if present else None


def _optional_int32(value: int, present: bool) -> int | None:
    return value if present else None
