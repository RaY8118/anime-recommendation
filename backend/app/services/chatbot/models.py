from pydantic import BaseModel, Field


class AnimeQuery(BaseModel):
    query: str = Field(
        description=(
            "A standalone, self-contained anime search query rewritten from the "
            "user's message and the conversation so far. Do not put filters here."
        )
    )
    genres: list[str] = Field(
        default_factory=list,
        description="AniList genre names in Title Case (e.g. 'Action', 'Sci-Fi').",
    )
    studios: list[str] = Field(
        default_factory=list,
        description="Studio names in Title Case (e.g. 'Madhouse').",
    )
    year_from: int | None = Field(
        default=None, description="Earliest release year the user asked for."
    )
    year_to: int | None = Field(
        default=None, description="Latest release year the user asked for."
    )
    min_score: int | None = Field(
        default=None, description="Minimum average score (0-100) the user asked for."
    )
    status: list[str] = Field(
        default_factory=list,
        description=(
            "Release status. Allowed values: FINISHED, RELEASING, "
            "NOT_YET_RELEASED, CANCELLED, HIATUS."
        ),
    )
    season: list[str] = Field(
        default_factory=list,
        description="Season of release. Allowed values: WINTER, SPRING, SUMMER, FALL.",
    )
