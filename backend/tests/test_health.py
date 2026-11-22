from fastapi.testclient import TestClient

from app.main import app

# No context manager: that would run the lifespan (Redis checkpointer setup).
client = TestClient(app)


def test_health():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_models():
    response = client.get("/v1/models")

    assert response.status_code == 200
    assert "models" in response.json()
