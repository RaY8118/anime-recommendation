from anime.v1 import ingest_pb2

from app.grpc_server.mapping import anime_request_to_document
from app.schemas.animes import Anime


def test_unset_optional_fields_map_to_none():
    doc = anime_request_to_document(
        ingest_pb2.IngestAnimeRequest(id=1, title=ingest_pb2.Title())
    )

    assert doc["id"] == 1
    assert doc["description"] is None
    assert doc["averageScore"] is None
    assert doc["episodes"] is None
    assert doc["seasonYear"] is None
    assert doc["isAdult"] is None
    assert doc["coverImage"] is None
    assert doc["title"] == {
        "romaji": None,
        "english": None,
        "display_romaji": None,
        "display_english": None,
    }
    # The result must still satisfy the schema used before the Mongo upsert.
    assert Anime.model_validate(doc).id == 1


def test_present_fields_are_kept_and_cleaned():
    doc = anime_request_to_document(
        ingest_pb2.IngestAnimeRequest(
            id=2,
            title=ingest_pb2.Title(
                title_romaji="Cowboy Bebop", title_english="Cowboy Bebop"
            ),
            description="Line one<br>Line <b>two</b>",
            genres=["Action"],
            average_score=85,
            episodes=26,
            season_year=1998,
            status="FINISHED",
            cover_image=ingest_pb2.CoverImage(
                large="https://example.com/cover.jpg"
            ),
            is_adult=False,
            popularity=1234,
        )
    )

    assert doc["title"]["romaji"] == "cowboy bebop"
    assert doc["title"]["display_romaji"] == "Cowboy Bebop"
    assert doc["description"] == "Line one Line two"
    assert doc["averageScore"] == 85
    assert doc["episodes"] == 26
    assert doc["seasonYear"] == 1998
    assert doc["status"] == "FINISHED"
    assert doc["coverImage"] == {"large": "https://example.com/cover.jpg"}
    assert doc["isAdult"] is False
    assert Anime.model_validate(doc).averageScore == 85
