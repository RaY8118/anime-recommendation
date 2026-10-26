"""LangGraph-powered anime recommendation chatbot.

Public API (unchanged from the former app.utils.langbot):
    - langchain_chatbot(message, model_id, db, session_id) -> str
    - stream_chatbot(message, model_id, db, session_id) -> event tuples
    - clear_chat_history(session_id)
    - setup_checkpointer() / close_checkpointer() for the app lifespan
"""

from app.services.chatbot.chat import langchain_chatbot, stream_chatbot
from app.services.chatbot.saver import (
    clear_chat_history,
    close_checkpointer,
    setup_checkpointer,
)

__all__ = [
    "clear_chat_history",
    "close_checkpointer",
    "langchain_chatbot",
    "setup_checkpointer",
    "stream_chatbot",
]
