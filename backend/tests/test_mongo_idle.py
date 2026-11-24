"""Mongo clients must be closeable so idle heartbeats don't block sleep."""

import asyncio

import pytest

import app.core.deps as deps
import app.main as main


class _FakeClient:
    def __init__(self):
        self.closed = False

    def close(self):
        self.closed = True


def test_close_mongo_clients_stops_monitoring(monkeypatch):
    motor = _FakeClient()
    sync = _FakeClient()
    monkeypatch.setattr(deps, "_motor_client", motor)
    monkeypatch.setattr(deps, "_sync_mongo_client", sync)

    deps.close_mongo_clients(force=True)

    assert motor.closed
    assert sync.closed
    assert deps._motor_client is None
    assert deps._sync_mongo_client is None


def test_close_mongo_clients_is_noop_when_never_opened(monkeypatch):
    monkeypatch.setattr(deps, "_motor_client", None)
    monkeypatch.setattr(deps, "_sync_mongo_client", None)

    deps.close_mongo_clients(force=True)  # must not raise


def test_client_is_recreated_after_idle_close(monkeypatch):
    created: list[str] = []

    def fake_client(uri):
        created.append(uri)
        return _FakeClient()

    monkeypatch.setattr(deps, "_motor_client", None)
    monkeypatch.setattr(deps, "AsyncIOMotorClient", fake_client)
    monkeypatch.setattr(deps, "is_mongo_idle", lambda: True)

    first = deps.get_mongo_client()
    assert deps.get_mongo_client() is first
    assert len(created) == 1

    deps.close_mongo_clients()

    second = deps.get_mongo_client()
    assert second is not first
    assert len(created) == 2


def test_close_keeps_clients_while_db_is_in_use(monkeypatch):
    client = _FakeClient()
    monkeypatch.setattr(deps, "_motor_client", client)
    monkeypatch.setattr(deps, "_sync_mongo_client", None)
    monkeypatch.setattr(deps, "is_mongo_idle", lambda: False)

    deps.close_mongo_clients()

    assert not client.closed
    assert deps._motor_client is client


class _StopWatcher(Exception):
    pass


def _run_watcher(monkeypatch, *, idle):
    closed: list[bool] = []
    sleeps: list[float] = []

    class FakeAsyncio:
        async def sleep(self, seconds):
            sleeps.append(seconds)
            if len(sleeps) >= 2:
                raise _StopWatcher

    monkeypatch.setattr(main, "asyncio", FakeAsyncio())
    monkeypatch.setattr(main, "MONGO_IDLE_TIMEOUT_SECONDS", 120.0)
    monkeypatch.setattr(main, "is_mongo_idle", lambda: idle)
    monkeypatch.setattr(main, "close_mongo_clients", lambda: closed.append(True))

    with pytest.raises(_StopWatcher):
        asyncio.run(main._watch_mongo_idle())
    return closed


def test_watcher_closes_clients_once_idle(monkeypatch):
    assert _run_watcher(monkeypatch, idle=True) == [True]


def test_watcher_keeps_clients_while_active(monkeypatch):
    assert _run_watcher(monkeypatch, idle=False) == []
