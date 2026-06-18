"""Iteration 2 backend test additions: payments, photos, chat read/unread, image/voice messages, Emergent Google auth."""
import uuid
import time
import requests


def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _register(api_client, base_url, prefix="x"):
    e = f"TEST_{prefix}_{uuid.uuid4().hex[:6]}@flick.app"
    u = api_client.post(
        f"{base_url}/api/auth/register",
        json={"email": e, "password": "Pass@1234", "display_name": prefix.upper()},
        timeout=30,
    ).json()
    return u


def _mutual_match(api_client, base_url):
    u1 = _register(api_client, base_url, "ch1")
    u2 = _register(api_client, base_url, "ch2")
    h1, h2 = auth_headers(u1["access_token"]), auth_headers(u2["access_token"])
    api_client.post(f"{base_url}/api/swipe", json={"target_id": u2["user"]["id"], "action": "like"}, headers=h1)
    r = api_client.post(f"{base_url}/api/swipe", json={"target_id": u1["user"]["id"], "action": "like"}, headers=h2)
    match_id = r.json()["match"]["id"]
    return u1, u2, h1, h2, match_id


# ────── Payments ──────
def test_checkout_premium_returns_url(api_client, base_url, ava_auth):
    h = auth_headers(ava_auth["access_token"])
    r = api_client.post(
        f"{base_url}/api/payments/checkout",
        json={"plan": "premium", "origin": base_url},
        headers=h,
        timeout=60,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "url" in body and isinstance(body["url"], str) and body["url"].startswith("http")
    assert "session_id" in body and body["session_id"]


def test_checkout_bad_plan(api_client, base_url, ava_auth):
    h = auth_headers(ava_auth["access_token"])
    r = api_client.post(
        f"{base_url}/api/payments/checkout",
        json={"plan": "free", "origin": base_url},
        headers=h,
    )
    assert r.status_code == 400


def test_checkout_status_owner_vs_stranger(api_client, base_url, ava_auth, liam_auth):
    ha = auth_headers(ava_auth["access_token"])
    hl = auth_headers(liam_auth["access_token"])
    r = api_client.post(
        f"{base_url}/api/payments/checkout",
        json={"plan": "premium_plus", "origin": base_url},
        headers=ha,
        timeout=60,
    )
    assert r.status_code == 200, r.text
    sid = r.json()["session_id"]

    # stranger -> 404
    s_other = api_client.get(f"{base_url}/api/payments/status/{sid}", headers=hl, timeout=60)
    assert s_other.status_code == 404

    # owner -> 200 with record fields
    s_own = api_client.get(f"{base_url}/api/payments/status/{sid}", headers=ha, timeout=60)
    assert s_own.status_code == 200, s_own.text
    rec = s_own.json()
    assert rec["session_id"] == sid
    assert rec["user_id"] == ava_auth["user"]["id"]
    assert rec["plan"] == "premium_plus"
    assert "status" in rec and "payment_status" in rec
    assert "_id" not in rec


# ────── Emergent Google Auth ──────
def test_emergent_google_bad_session(api_client, base_url):
    r = api_client.post(
        f"{base_url}/api/auth/emergent/google",
        json={"session_id": "totally-bogus-session-id"},
        timeout=30,
    )
    # Must not 500; should be 401 (rejected by Emergent) or 502 (upstream unreachable)
    assert r.status_code in (401, 502), f"unexpected status {r.status_code}: {r.text[:200]}"


def test_emergent_google_validation_error(api_client, base_url):
    r = api_client.post(f"{base_url}/api/auth/emergent/google", json={}, timeout=30)
    assert r.status_code == 422


# ────── Profile photos ──────
def test_profile_photos_put_and_clip_to_6(api_client, base_url):
    u = _register(api_client, base_url, "pho")
    h = auth_headers(u["access_token"])
    photos = [f"https://example.com/p{i}.jpg" for i in range(8)]
    r = api_client.put(f"{base_url}/api/profile/photos", json={"photos": photos}, headers=h)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["photos"] == photos[:6]
    assert len(body["photos"]) == 6
    # verify via /me
    me = api_client.get(f"{base_url}/api/auth/me", headers=h).json()
    assert me["photos"] == photos[:6]


# ────── Chat: image-only / voice-only ──────
def test_chat_send_text_image_voice_types(api_client, base_url):
    u1, u2, h1, h2, mid = _mutual_match(api_client, base_url)

    # text
    rt = api_client.post(
        f"{base_url}/api/chat/send",
        json={"match_id": mid, "text": "hello!"},
        headers=h1,
        timeout=60,
    )
    assert rt.status_code == 200, rt.text
    assert rt.json()["message"]["type"] == "text"

    # image-only (no text) -> should skip moderation, succeed
    img = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAAEAAAIBRAA7"
    ri = api_client.post(
        f"{base_url}/api/chat/send",
        json={"match_id": mid, "image_base64": img},
        headers=h1,
        timeout=60,
    )
    assert ri.status_code == 200, ri.text
    assert ri.json()["message"]["type"] == "image"
    assert ri.json()["message"]["image_base64"] == img

    # voice-only
    voi = "data:audio/m4a;base64,AAECAwQFBg=="
    rv = api_client.post(
        f"{base_url}/api/chat/send",
        json={"match_id": mid, "voice_base64": voi, "voice_duration_ms": 1500},
        headers=h2,
        timeout=60,
    )
    assert rv.status_code == 200, rv.text
    msg = rv.json()["message"]
    assert msg["type"] == "voice"
    assert msg["voice_base64"] == voi
    assert msg["voice_duration_ms"] == 1500

    # GET messages: all 3 with `type`
    msgs = api_client.get(f"{base_url}/api/chat/{mid}/messages", headers=h1, timeout=60).json()["items"]
    types = [m.get("type") for m in msgs]
    assert "text" in types and "image" in types and "voice" in types


def test_chat_send_empty_text_400(api_client, base_url):
    _, _, h1, _, mid = _mutual_match(api_client, base_url)
    r = api_client.post(
        f"{base_url}/api/chat/send",
        json={"match_id": mid},  # nothing
        headers=h1,
        timeout=60,
    )
    assert r.status_code == 400


# ────── Chat read / unread counter ──────
def test_chat_read_and_unread_counts(api_client, base_url):
    u1, u2, h1, h2, mid = _mutual_match(api_client, base_url)

    # u2 sends 2 msgs to u1
    api_client.post(f"{base_url}/api/chat/send", json={"match_id": mid, "text": "hi 1"}, headers=h2, timeout=60)
    api_client.post(f"{base_url}/api/chat/send", json={"match_id": mid, "text": "hi 2"}, headers=h2, timeout=60)

    matches = api_client.get(f"{base_url}/api/matches", headers=h1).json()["items"]
    mine = next(m for m in matches if m["id"] == mid)
    assert isinstance(mine["unread"], int)
    assert mine["unread"] >= 2

    # mark as read
    rr = api_client.post(f"{base_url}/api/chat/read", json={"match_id": mid}, headers=h1)
    assert rr.status_code == 200

    matches2 = api_client.get(f"{base_url}/api/matches", headers=h1).json()["items"]
    mine2 = next(m for m in matches2 if m["id"] == mid)
    assert mine2["unread"] == 0

    # New msg from u2 increases unread to >=1 again
    time.sleep(1)
    api_client.post(f"{base_url}/api/chat/send", json={"match_id": mid, "text": "hi 3"}, headers=h2, timeout=60)
    matches3 = api_client.get(f"{base_url}/api/matches", headers=h1).json()["items"]
    mine3 = next(m for m in matches3 if m["id"] == mid)
    assert mine3["unread"] >= 1


def test_chat_read_unauthorized_match_404(api_client, base_url, ava_auth):
    h = auth_headers(ava_auth["access_token"])
    r = api_client.post(f"{base_url}/api/chat/read", json={"match_id": "bogus"}, headers=h)
    assert r.status_code == 404
