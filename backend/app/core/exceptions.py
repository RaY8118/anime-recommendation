from fastapi import HTTPException, status


class AnimeNotFoundException(HTTPException):
    def __init__(self, detail: str = "Anime not found"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


class AnimeAlreadyExistsException(HTTPException):
    def __init__(self, detail: str = "Anime already exists"):
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail)


class BadRequestException(HTTPException):
    def __init__(self, detail: str = "Bad request"):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


class NotFoundException(HTTPException):
    def __init__(self, detail: str = "Not found"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


class InternalServerErrorException(HTTPException):
    def __init__(self, detail: str = "Internal server error"):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=detail
        )


class ServiceUnavailableException(HTTPException):
    def __init__(self, detail: str = "Service unavailable"):
        super().__init__(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=detail)
