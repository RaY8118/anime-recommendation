import json

from app.core.deps import get_database
from app.schemas.chatbot import (
    AVAILABLE_MODELS,
    ChatBotRequest,
    ChatBotResponse,
    ClearChatHistoryRequest,
)
from app.schemas.common import MessageResponse
from app.core.exceptions import AnimeNotFoundException, ServiceUnavailableException
from app.services.chatbot.chat import langchain_chatbot, stream_chatbot
from app.services.chatbot.saver import clear_chat_history
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorDatabase

router = APIRouter()


@router.get("/chatbot/models")
async def get_chatbot_models():
    return {"models": AVAILABLE_MODELS}


@router.post("/chatbot", response_model=ChatBotResponse)
async def Chatbot(
    request: ChatBotRequest, db: AsyncIOMotorDatabase = Depends(get_database)
):
    try:
        results = await langchain_chatbot(
            request.message,
            request.model_id,
            db,
            session_id=request.session_id or "default",
            sfw=request.sfw,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=503, detail=f"Chatbot is unavailable: {exc}"
        ) from exc

    if not results:
        raise AnimeNotFoundException(detail="No results found")
    return {"results": results}


@router.post("/chatbot/stream")
async def StreamChatbot(
    request: ChatBotRequest, db: AsyncIOMotorDatabase = Depends(get_database)
):
    async def event_generator():
        try:
            async for event, data in stream_chatbot(
                request.message,
                request.model_id,
                db,
                session_id=request.session_id or "default",
                sfw=request.sfw,
            ):
                yield f"event: {event}\ndata: {json.dumps(data)}\n\n"
        except Exception as exc:
            print(f"Streaming chatbot failed: {exc}")
            yield (
                "event: error\n"
                f"data: {json.dumps({'message': 'Something went wrong. Please try again.'})}\n\n"
            )

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/chatbot/clear", response_model=MessageResponse)
async def clear_chatbot(request: ClearChatHistoryRequest):
    try:
        await clear_chat_history(request.session_id)
    except Exception as exc:
        raise HTTPException(
            status_code=503, detail=f"Failed to clear chat history: {exc}"
        ) from exc

    return {"message": "Chat history cleared"}
