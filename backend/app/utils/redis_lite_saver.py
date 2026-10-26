"""A minimal async Redis checkpointer for Redis servers without RediSearch.

`AsyncRedisSaver` (langgraph-checkpoint-redis) depends on the RediSearch
module (FT.CREATE / FT.INFO / FT.SEARCH), which hosted providers such as
Upstash do not support (they only expose SEARCH.*). This saver stores
LangGraph checkpoints with plain Redis commands (HSET / GET / SET / SCAN /
EXPIRE), so it works on any Redis-compatible server, including Upstash.

Format (all keys prefixed, default "kgckpt"):
    {prefix}:latest:{thread_id}                     -> str   latest checkpoint id
    {prefix}:ckpt:{thread_id}:{checkpoint_id}       -> hash  checkpoint + metadata blobs
    {prefix}:writes:{thread_id}:{checkpoint_id}     -> hash  task_id -> writes blob

Only the async surface is implemented (the app is fully async); sync
methods deliberately fall back to the base-class NotImplementedError.
"""

from __future__ import annotations

import warnings
from collections.abc import AsyncIterator, Iterator, Sequence
from typing import Any

from langchain_core.runnables import RunnableConfig
from redis.asyncio import Redis as AsyncRedis

# Suppress the Reviver(`allowed_objects`) pending-deprecation warning that
# langgraph emits at import time (injected inside the library itself).
with warnings.catch_warnings():
    warnings.filterwarnings("ignore", message=r".*`allowed_objects`.*")
    from langgraph.checkpoint.base import (
        BaseCheckpointSaver,
        ChannelVersions,
        Checkpoint,
        CheckpointMetadata,
        CheckpointTuple,
        PendingWrite,
        V,
    )

DEFAULT_PREFIX = "kgckpt"


class AsyncRedisLiteSaver(BaseCheckpointSaver[V]):
    """Plain-command Redis checkpointer (no RediSearch required)."""

    def __init__(
        self,
        redis_url: str,
        *,
        key_prefix: str = DEFAULT_PREFIX,
        ttl_seconds: int | None = None,
    ) -> None:
        super().__init__()
        self._client = AsyncRedis.from_url(redis_url)
        self._prefix = key_prefix
        self.ttl_seconds = ttl_seconds

    # -- keys ---------------------------------------------------------------

    def _latest_key(self, thread_id: str) -> str:
        return f"{self._prefix}:latest:{thread_id}"

    def _checkpoint_key(self, thread_id: str, checkpoint_id: str) -> str:
        return f"{self._prefix}:ckpt:{thread_id}:{checkpoint_id}"

    def _writes_key(self, thread_id: str, checkpoint_id: str) -> str:
        return f"{self._prefix}:writes:{thread_id}:{checkpoint_id}"

    async def _apply_ttl(self, *keys: str) -> None:
        if self.ttl_seconds:
            for key in keys:
                await self._client.expire(key, self.ttl_seconds)

    # -- async surface -------------------------------------------------------

    async def asetup(self) -> None:
        """No schema/indices needed (plain commands). Kept for API parity."""

    async def aput(
        self,
        config: RunnableConfig,
        checkpoint: Checkpoint,
        metadata: CheckpointMetadata,
        new_versions: ChannelVersions,
    ) -> RunnableConfig:
        thread_id = config["configurable"]["thread_id"]
        checkpoint_id = checkpoint["id"]
        parent_id = config["configurable"].get("checkpoint_id")

        checkpoint_blob = self.serde.dumps_typed(checkpoint)
        metadata_blob = self.serde.dumps_typed(metadata)

        checkpoint_key = self._checkpoint_key(thread_id, checkpoint_id)
        await self._client.hset(
            checkpoint_key,
            mapping={
                "checkpoint": checkpoint_blob[1],
                "checkpoint_type": checkpoint_blob[0],
                "metadata": metadata_blob[1],
                "metadata_type": metadata_blob[0],
                "parent_id": parent_id or "",
            },
        )
        await self._client.set(self._latest_key(thread_id), checkpoint_id)
        await self._apply_ttl(
            checkpoint_key,
            self._latest_key(thread_id),
        )

        return {
            **config,
            "configurable": {
                **config["configurable"],
                "checkpoint_id": checkpoint_id,
            },
        }

    async def aput_writes(
        self,
        config: RunnableConfig,
        writes: Sequence[tuple[str, Any]],
        task_id: str,
        task_path: str = "",
    ) -> None:
        thread_id = config["configurable"]["thread_id"]
        checkpoint_id = config["configurable"].get("checkpoint_id")
        if not checkpoint_id:
            # Writes cannot be attached to a thread without a checkpoint.
            return

        blob = self.serde.dumps_typed(list(writes))
        writes_key = self._writes_key(thread_id, checkpoint_id)
        typed_blob = b" ".join((blob[0].encode("utf-8"), blob[1]))
        await self._client.hset(writes_key, task_id, typed_blob)
        await self._apply_ttl(writes_key)

    async def aget_tuple(self, config: RunnableConfig) -> CheckpointTuple | None:
        thread_id = config["configurable"]["thread_id"]
        requested_id = config["configurable"].get("checkpoint_id")

        checkpoint_id = requested_id
        if checkpoint_id is None:
            checkpoint_id = await self._client.get(self._latest_key(thread_id))
            if checkpoint_id is None:
                return None
        if isinstance(checkpoint_id, bytes):
            checkpoint_id = checkpoint_id.decode("utf-8")

        data = await self._client.hgetall(
            self._checkpoint_key(thread_id, checkpoint_id)
        )
        if not data:
            return None

        data = {
            (key.decode("utf-8") if isinstance(key, bytes) else key): value
            for key, value in data.items()
        }

        checkpoint_type = data["checkpoint_type"].decode("utf-8")
        checkpoint = self.serde.loads_typed(
            (checkpoint_type, data["checkpoint"])
        )
        metadata_type = data["metadata_type"].decode("utf-8")
        metadata = self.serde.loads_typed((metadata_type, data["metadata"]))

        checkpoint_config: RunnableConfig = {
            "configurable": {
                "thread_id": thread_id,
                "checkpoint_id": checkpoint_id,
            }
        }
        parent_config: RunnableConfig | None = None
        parent_id = data.get("parent_id")
        if parent_id:
            if isinstance(parent_id, bytes):
                parent_id = parent_id.decode("utf-8")
            if parent_id:
                parent_config = {
                    "configurable": {
                        "thread_id": thread_id,
                        "checkpoint_id": parent_id,
                    }
                }

        pending_writes: list[PendingWrite] = []
        writes_data = await self._client.hgetall(
            self._writes_key(thread_id, checkpoint_id)
        )
        for task_id, blob in writes_data.items():
            if isinstance(task_id, bytes):
                task_id = task_id.decode("utf-8")
            blob_type, blob = blob.split(b" ", 1)
            writes = self.serde.loads_typed((blob_type.decode("utf-8"), blob))
            for channel, value in writes:
                pending_writes.append((channel, task_id, value))

        if self.ttl_seconds and not requested_id:
            # refresh_on_read: keep active threads alive (least-magic TTL).
            await self._apply_ttl(
                self._checkpoint_key(thread_id, checkpoint_id),
                self._latest_key(thread_id),
            )

        return CheckpointTuple(
            config=checkpoint_config,
            checkpoint=checkpoint,
            metadata=metadata,
            parent_config=parent_config,
            pending_writes=pending_writes or None,
        )

    async def alist(
        self,
        config: RunnableConfig | None,
        *,
        filter: dict[str, Any] | None = None,
        before: RunnableConfig | None = None,
        limit: int | None = None,
    ) -> AsyncIterator[CheckpointTuple]:
        if config is None:
            return
        thread_id = config["configurable"].get("thread_id")
        if not thread_id:
            return
        if tuple_value := await self.aget_tuple(config):
            yield tuple_value

    async def adelete_thread(self, thread_id: str) -> None:
        batch: list[str] = []
        for pattern in (
            f"{self._prefix}:ckpt:{thread_id}:*",
            f"{self._prefix}:writes:{thread_id}:*",
        ):
            async for chunk in self._client.scan_iter(match=pattern, count=100):
                batch.append(chunk if isinstance(chunk, str) else chunk.decode("utf-8"))
                if len(batch) >= 100:
                    await self._client.delete(*batch)
                    batch = []
        batch.append(self._latest_key(thread_id))
        await self._client.delete(*batch)

    async def close(self) -> None:
        await self._client.aclose()

    # -- sync surface (app is fully async; keep base-class raising) -----------

    def get_tuple(self, config: RunnableConfig) -> CheckpointTuple | None:
        raise NotImplementedError("Use aget_tuple / run the graph with ainvoke/astream")

    def list(
        self,
        config: RunnableConfig | None,
        *,
        filter: dict[str, Any] | None = None,
        before: RunnableConfig | None = None,
        limit: int | None = None,
    ) -> Iterator[CheckpointTuple]:
        raise NotImplementedError("Use ainvoke/astream (async-only saver)")

    def put(
        self,
        config: RunnableConfig,
        checkpoint: Checkpoint,
        metadata: CheckpointMetadata,
        new_versions: ChannelVersions,
    ) -> RunnableConfig:
        raise NotImplementedError("Use ainvoke/astream (async-only saver)")

    def put_writes(
        self,
        config: RunnableConfig,
        writes: Sequence[tuple[str, Any]],
        task_id: str,
        task_path: str = "",
    ) -> None:
        raise NotImplementedError("Use ainvoke/astream (async-only saver)")

    def delete_thread(self, thread_id: str) -> None:
        raise NotImplementedError("Use adelete_thread (async-only saver)")
