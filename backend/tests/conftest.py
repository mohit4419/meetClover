import os
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")


@pytest.fixture(scope="session")
def base_url():
    assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL not set"
    return BASE_URL


@pytest.fixture()
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(client, base, email, password):
    r = client.post(f"{base}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    return r.json()


@pytest.fixture()
def ava_auth(api_client, base_url):
    return _login(api_client, base_url, "ava@flick.app", "Demo@1234")


@pytest.fixture()
def liam_auth(api_client, base_url):
    return _login(api_client, base_url, "liam@flick.app", "Demo@1234")


@pytest.fixture()
def admin_auth(api_client, base_url):
    return _login(api_client, base_url, "admin@flick.app", "Admin@12345")


def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
