"""Redis sockets must not emit idle keepalive traffic."""

import app.services.chatbot.saver as saver


def test_redis_client_disables_idle_keepalives(monkeypatch):
    captured: dict = {}

    class FakeRedis:
        @classmethod
        def from_url(cls, url, **kwargs):
            captured["url"] = url
            captured.update(kwargs)
            return object()

    monkeypatch.setattr(saver, "AsyncRedis", FakeRedis)

    saver.AsyncRedisLiteSaver("rediss://example.upstash.io:6379")

    assert captured["url"] == "rediss://example.upstash.io:6379"
    assert captured["health_check_interval"] == 0
    assert captured["socket_keepalive"] is False
