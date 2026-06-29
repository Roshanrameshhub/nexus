from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture()
def client():
    with patch("app.main.init_db", new=AsyncMock()):
        with TestClient(app, raise_server_exceptions=False) as test_client:
            yield test_client


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_login_rejects_invalid_credentials(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "nobody@example.com", "password": "wrong-password"},
    )
    assert response.status_code == 401


def test_signup_rejects_short_password(client):
    response = client.post(
        "/api/auth/signup",
        json={
            "email": "test@example.com",
            "password": "short",
            "name": "Test User",
        },
    )
    assert response.status_code == 422


def test_google_auth_rejects_invalid_token(client):
    response = client.post(
        "/api/auth/google",
        json={"id_token": "invalid-token"},
    )
    assert response.status_code == 401


def test_refresh_rejects_invalid_token(client):
    response = client.post(
        "/api/auth/refresh",
        json={"refresh_token": "invalid-token"},
    )
    assert response.status_code == 401


def test_forgot_password_always_returns_success_message(client):
    response = client.post(
        "/api/auth/forgot-password",
        json={"email": "unknown@example.com"},
    )
    assert response.status_code == 200
    assert "reset link" in response.json()["message"].lower()


def test_reset_password_rejects_invalid_token(client):
    response = client.post(
        "/api/auth/reset-password",
        json={"token": "not-a-real-token", "password": "validpass1"},
    )
    assert response.status_code == 400
