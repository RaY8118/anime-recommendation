import warnings
from typing import Annotated, TypedDict

from langchain_core.documents import Document
from langchain_core.messages import BaseMessage

# Suppress the Reviver(`allowed_objects`) pending-deprecation warning that
# langgraph emits at import time (injected inside the library itself).
with warnings.catch_warnings():
    warnings.filterwarnings("ignore", message=r".*`allowed_objects`.*")
    from langgraph.graph.message import add_messages


class ChatState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    docs: list[Document]
