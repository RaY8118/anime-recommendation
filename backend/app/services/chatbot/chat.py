import asyncio

from langchain_core.messages import HumanMessage
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.services.chatbot.config import LLM_TIMEOUT_SECONDS, STREAM_TIMEOUT_SECONDS
from app.services.chatbot.graph import _build_session_graph


async def langchain_chatbot(
    message: str, model_id: str, db: AsyncIOMotorDatabase, session_id: str = "default"
) -> str:
    try:
        graph = await _build_session_graph(db, model_id)
        result = await asyncio.wait_for(
            graph.ainvoke(
                {"messages": [HumanMessage(content=message)]},
                config={"configurable": {"thread_id": session_id}},
            ),
            timeout=LLM_TIMEOUT_SECONDS,
        )
    except Exception as exc:
        print(f"Chatbot LLM call failed: {exc}")
        return "I'm having trouble connecting to my brain right now!"

    final_messages = result.get("messages") or []
    if not final_messages:
        return "I'm having trouble connecting to my brain right now!"

    answer = final_messages[-1].content
    return answer if isinstance(answer, str) else str(answer)


async def stream_chatbot(
    message: str, model_id: str, db: AsyncIOMotorDatabase, session_id: str = "default"
):
    yield ("status", {"stage": "thinking"})

    try:
        graph = await _build_session_graph(db, model_id)
    except Exception as exc:
        print(f"Loading chat history failed: {exc}")
        yield (
            "error",
            {"message": "I'm having trouble connecting to my brain right now!"},
        )
        return

    stream = graph.astream(
        {"messages": [HumanMessage(content=message)]},
        {"configurable": {"thread_id": session_id}},
        stream_mode=["messages", "custom"],
    ).__aiter__()

    chunks: list[str] = []
    try:
        while True:
            try:
                event = await asyncio.wait_for(
                    stream.__anext__(), timeout=STREAM_TIMEOUT_SECONDS
                )
            except StopAsyncIteration:
                break

            if not event:
                continue

            mode, payload = event

            if mode == "messages":
                chunk, metadata = payload
                text = getattr(chunk, "content", None)
                if (
                    metadata.get("langgraph_node") == "chat"
                    and isinstance(text, str)
                    and text
                ):
                    chunks.append(text)
                    yield ("token", {"text": text})
            elif mode == "custom":
                event_name = (payload or {}).get("event")
                data = (payload or {}).get("data")
                if event_name == "status" and data:
                    yield ("status", data)
                elif event_name == "sources" and data:
                    yield ("sources", data)
    except Exception as exc:
        print(f"Streaming failed: {exc}")
        yield (
            "error",
            {"message": "I'm having trouble connecting to my brain right now!"},
        )
        return

    answer = "".join(chunks)

    yield ("done", {"text": answer})
