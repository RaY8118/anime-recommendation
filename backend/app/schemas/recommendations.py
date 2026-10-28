from enum import Enum


class QueryMode(str, Enum):
    anime_name = "anime_name"
    genre = "genre"
    description = "description"
