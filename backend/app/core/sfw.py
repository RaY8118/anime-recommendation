"""Helpers for hiding adult content when SFW mode is enabled."""

from typing import Any

from qdrant_client.http.models import FieldCondition, Filter, MatchValue

ADULT_GENRES = ("Hentai", "Ecchi")
_ADULT_GENRES_LOWER = {genre.lower() for genre in ADULT_GENRES}

# Matches any document that has neither an adult genre nor the isAdult flag.
SFW_MONGO_FILTER: dict[str, Any] = {
    "genres": {"$nin": list(ADULT_GENRES)},
    "isAdult": {"$ne": True},
}


def is_adult_content(genres: list[str] | None) -> bool:
    """Return True when the given genres include adult/suggestive content."""
    return any((genre or "").lower() in _ADULT_GENRES_LOWER for genre in genres or [])


def apply_sfw_mongo_filter(query: dict[str, Any], sfw: bool = True) -> dict[str, Any]:
    """Wrap a Mongo query so adult titles are excluded when SFW mode is on."""
    if not sfw:
        return query
    return {"$and": [query, SFW_MONGO_FILTER]}


def merge_sfw_qdrant_filter(filters: Filter | None, sfw: bool = True) -> Filter | None:
    """Add the SFW exclusions to an existing Qdrant filter."""
    if not sfw:
        return filters

    sfw_clause = [
        FieldCondition(key="metadata.genres", match=MatchValue(value=genre))
        for genre in ADULT_GENRES
    ]

    if filters is None:
        return Filter(must_not=sfw_clause)

    return Filter(
        must=filters.must,
        should=filters.should,
        must_not=[*(filters.must_not or []), *sfw_clause],
    )
