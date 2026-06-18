"""Flick backend full API test suite."""
import os
import time
import uuid
import requests


def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# --------- Health ---------
def test_root(api_client, base_url):
    r = api_client.get(f"{base_url}/api/")
    assert r.status_code == 200
    assert r.json().get("ok") is True


# --------- Auth ---------
def test_register_and_me(api_client, base_url):
    email = f"TEST_user_{uuid.uuid4().hex[:8]}@flick.app"
    r = api_client.post(f"{base_url}/api/auth/register", json={
        "email": email, "password": "Pass@1234", "display_name": "Test U"
    })
    assert r.status_code == 201, r.text
    data = r.json()
    assert "access_token" in data and "refresh_token" in data
    assert data["user"]["email"] == email
    assert "_id" not in data["user"]
    # me
    me = api_client.get(f"{base_url}/api/auth/me", headers=auth_headers(data["access_token"]))
    assert me.status_code == 200
    assert me.json()["email"] == email


def test_register_duplicate_400(api_client, base_url):
    r = api_client.post(f"{base_url}/api/auth/register", json={
        "email": "ava@flick.app", "password": "Demo@1234", "display_name": "X"
    })
    assert r.status_code == 400


def test_login_invalid(api_client, base_url):
    r = api_client.post(f"{base_url}/api/auth/login", json={"email": "ava@flick.app", "password": "bad"})
    assert r.status_code == 401


def test_login_ava(ava_auth):
    assert ava_auth["user"]["email"] == "ava@flick.app"
    assert "_id" not in ava_auth["user"]


def test_refresh(api_client, base_url, ava_auth):
    r = api_client.post(f"{base_url}/api/auth/refresh", json={"refresh_token": ava_auth["refresh_token"]})
    assert r.status_code == 200
    assert r.json()["user"]["email"] == "ava@flick.app"


def test_auth_me_no_token_401(api_client, base_url):
    r = api_client.get(f"{base_url}/api/auth/me")
    assert r.status_code in (401, 403)


# --------- Profile ---------
def test_update_profile(api_client, base_url, ava_auth):
    h = auth_headers(ava_auth["access_token"])
    new_bio = f"TEST_bio_{uuid.uuid4().hex[:6]}"
    r = api_client.put(f"{base_url}/api/profile", json={"bio": new_bio, "interests": ["music", "art"]}, headers=h)
    assert r.status_code == 200
    body = r.json()
    assert body["bio"] == new_bio
    assert "_id" not in body
    # Verify via /me
    me = api_client.get(f"{base_url}/api/auth/me", headers=h).json()
    assert me["bio"] == new_bio


def test_get_user_by_id(api_client, base_url, ava_auth, liam_auth):
    h = auth_headers(ava_auth["access_token"])
    target_id = liam_auth["user"]["id"]
    r = api_client.get(f"{base_url}/api/users/{target_id}", headers=h)
    assert r.status_code == 200
    assert r.json()["id"] == target_id
    assert "_id" not in r.json()


def test_get_user_not_found(api_client, base_url, ava_auth):
    h = auth_headers(ava_auth["access_token"])
    r = api_client.get(f"{base_url}/api/users/does-not-exist-uid", headers=h)
    assert r.status_code == 404


# --------- Discover / Swipe ---------
def test_discover_excludes_self(api_client, base_url, ava_auth):
    h = auth_headers(ava_auth["access_token"])
    r = api_client.get(f"{base_url}/api/discover", headers=h)
    assert r.status_code == 200
    items = r.json()["items"]
    ids = [u["id"] for u in items]
    assert ava_auth["user"]["id"] not in ids
    assert len(items) >= 1


def test_swipe_and_mutual_match(api_client, base_url):
    # Fresh users to guarantee mutual match without polluting demo data
    e1 = f"TEST_a_{uuid.uuid4().hex[:6]}@flick.app"
    e2 = f"TEST_b_{uuid.uuid4().hex[:6]}@flick.app"
    u1 = api_client.post(f"{base_url}/api/auth/register", json={"email": e1, "password": "Pass@1234", "display_name": "A"}).json()
    u2 = api_client.post(f"{base_url}/api/auth/register", json={"email": e2, "password": "Pass@1234", "display_name": "B"}).json()
    h1 = auth_headers(u1["access_token"])
    h2 = auth_headers(u2["access_token"])
    # u1 likes u2
    r1 = api_client.post(f"{base_url}/api/swipe", json={"target_id": u2["user"]["id"], "action": "like"}, headers=h1)
    assert r1.status_code == 200
    assert r1.json()["match"] is None
    # u2 likes u1 -> match
    r2 = api_client.post(f"{base_url}/api/swipe", json={"target_id": u1["user"]["id"], "action": "like"}, headers=h2)
    assert r2.status_code == 200
    match = r2.json()["match"]
    assert match is not None
    assert match["other_user"]["id"] == u1["user"]["id"]

    # /matches returns this match for u1
    ml = api_client.get(f"{base_url}/api/matches", headers=h1)
    assert ml.status_code == 200
    items = ml.json()["items"]
    assert any(m["other_user"]["id"] == u2["user"]["id"] for m in items)
    return u1, u2, match["id"]


def test_swipe_self_400(api_client, base_url, ava_auth):
    h = auth_headers(ava_auth["access_token"])
    r = api_client.post(f"{base_url}/api/swipe", json={"target_id": ava_auth["user"]["id"], "action": "like"}, headers=h)
    assert r.status_code == 400


def test_swipe_bad_action_400(api_client, base_url, ava_auth, liam_auth):
    h = auth_headers(ava_auth["access_token"])
    r = api_client.post(f"{base_url}/api/swipe", json={"target_id": liam_auth["user"]["id"], "action": "love"}, headers=h)
    assert r.status_code == 400


def test_swipe_undo(api_client, base_url):
    e = f"TEST_undo_{uuid.uuid4().hex[:6]}@flick.app"
    u = api_client.post(f"{base_url}/api/auth/register", json={"email": e, "password": "Pass@1234", "display_name": "U"}).json()
    h = auth_headers(u["access_token"])
    # find a target
    items = api_client.get(f"{base_url}/api/discover", headers=h).json()["items"]
    assert items, "discover empty"
    target = items[0]["id"]
    api_client.post(f"{base_url}/api/swipe", json={"target_id": target, "action": "pass"}, headers=h)
    r = api_client.post(f"{base_url}/api/swipe/undo", headers=h)
    assert r.status_code == 200
    assert r.json().get("undone") == target


# --------- Chat ---------
def test_chat_send_and_messages(api_client, base_url):
    # create mutual match
    e1 = f"TEST_c1_{uuid.uuid4().hex[:6]}@flick.app"
    e2 = f"TEST_c2_{uuid.uuid4().hex[:6]}@flick.app"
    u1 = api_client.post(f"{base_url}/api/auth/register", json={"email": e1, "password": "Pass@1234", "display_name": "C1"}).json()
    u2 = api_client.post(f"{base_url}/api/auth/register", json={"email": e2, "password": "Pass@1234", "display_name": "C2"}).json()
    h1 = auth_headers(u1["access_token"]); h2 = auth_headers(u2["access_token"])
    api_client.post(f"{base_url}/api/swipe", json={"target_id": u2["user"]["id"], "action": "like"}, headers=h1)
    r = api_client.post(f"{base_url}/api/swipe", json={"target_id": u1["user"]["id"], "action": "like"}, headers=h2)
    match_id = r.json()["match"]["id"]

    # send a clean message (AI moderation may be slow)
    send = api_client.post(f"{base_url}/api/chat/send",
                          json={"match_id": match_id, "text": "Hello, nice to meet you!"}, headers=h1, timeout=60)
    assert send.status_code == 200, send.text
    body = send.json()
    assert body["ok"] is True
    assert body["message"]["text"] == "Hello, nice to meet you!"
    assert "_id" not in body["message"]

    msgs = api_client.get(f"{base_url}/api/chat/{match_id}/messages", headers=h2)
    assert msgs.status_code == 200
    items = msgs.json()["items"]
    assert any(m["text"] == "Hello, nice to meet you!" for m in items)


def test_chat_unauthorized_match_404(api_client, base_url, ava_auth):
    h = auth_headers(ava_auth["access_token"])
    r = api_client.get(f"{base_url}/api/chat/bogus-match-id/messages", headers=h)
    assert r.status_code == 404


# --------- AI ---------
def test_ai_moderate(api_client, base_url, ava_auth):
    h = auth_headers(ava_auth["access_token"])
    r = api_client.post(f"{base_url}/api/ai/moderate", json={"text": "Hello, how are you today?"}, headers=h, timeout=60)
    assert r.status_code == 200
    body = r.json()
    assert set(["allowed", "reason", "severity"]).issubset(body.keys())
    assert isinstance(body["allowed"], bool)


def test_ai_translate_es(api_client, base_url, ava_auth):
    h = auth_headers(ava_auth["access_token"])
    r = api_client.post(f"{base_url}/api/ai/translate", json={"text": "Hello, friend", "target_language": "es"}, headers=h, timeout=60)
    assert r.status_code == 200
    body = r.json()
    assert "translated_text" in body
    assert isinstance(body["translated_text"], str) and len(body["translated_text"]) > 0


# --------- Video lobby ---------
def test_video_queue_match_and_cancel(api_client, base_url):
    e1 = f"TEST_v1_{uuid.uuid4().hex[:6]}@flick.app"
    e2 = f"TEST_v2_{uuid.uuid4().hex[:6]}@flick.app"
    u1 = api_client.post(f"{base_url}/api/auth/register", json={"email": e1, "password": "Pass@1234", "display_name": "V1"}).json()
    u2 = api_client.post(f"{base_url}/api/auth/register", json={"email": e2, "password": "Pass@1234", "display_name": "V2"}).json()
    h1 = auth_headers(u1["access_token"]); h2 = auth_headers(u2["access_token"])

    r1 = api_client.post(f"{base_url}/api/video/start", json={}, headers=h1)
    assert r1.status_code == 200
    assert r1.json()["matched"] is False

    r2 = api_client.post(f"{base_url}/api/video/start", json={}, headers=h2)
    assert r2.status_code == 200
    body = r2.json()
    assert body["matched"] is True
    assert body["peer"]["id"] == u1["user"]["id"]
    sid = body["session_id"]
    assert sid

    end = api_client.post(f"{base_url}/api/video/end", json={"session_id": sid}, headers=h2)
    assert end.status_code == 200
    cancel = api_client.post(f"{base_url}/api/video/cancel", headers=h1)
    assert cancel.status_code == 200


# --------- Subscription / Wallet ---------
def test_subscription_update(api_client, base_url):
    e = f"TEST_sub_{uuid.uuid4().hex[:6]}@flick.app"
    u = api_client.post(f"{base_url}/api/auth/register", json={"email": e, "password": "Pass@1234", "display_name": "S"}).json()
    h = auth_headers(u["access_token"])
    r = api_client.post(f"{base_url}/api/subscription", json={"plan": "premium"}, headers=h)
    assert r.status_code == 200
    assert r.json()["subscription_tier"] == "premium"
    me = api_client.get(f"{base_url}/api/auth/me", headers=h).json()
    assert me["subscription_tier"] == "premium"


def test_subscription_bad_plan(api_client, base_url, ava_auth):
    h = auth_headers(ava_auth["access_token"])
    r = api_client.post(f"{base_url}/api/subscription", json={"plan": "ultra"}, headers=h)
    assert r.status_code == 400


def test_wallet_buy_pack(api_client, base_url):
    e = f"TEST_wal_{uuid.uuid4().hex[:6]}@flick.app"
    u = api_client.post(f"{base_url}/api/auth/register", json={"email": e, "password": "Pass@1234", "display_name": "W"}).json()
    h = auth_headers(u["access_token"])
    before = u["user"]["coins"]
    r = api_client.post(f"{base_url}/api/wallet/buy/small", headers=h)
    assert r.status_code == 200
    assert r.json()["coins"] == before + 100


def test_wallet_bad_pack(api_client, base_url, ava_auth):
    h = auth_headers(ava_auth["access_token"])
    r = api_client.post(f"{base_url}/api/wallet/buy/giant", headers=h)
    assert r.status_code == 400


# --------- Report ---------
def test_report_decreases_trust(api_client, base_url):
    e1 = f"TEST_r1_{uuid.uuid4().hex[:6]}@flick.app"
    e2 = f"TEST_r2_{uuid.uuid4().hex[:6]}@flick.app"
    u1 = api_client.post(f"{base_url}/api/auth/register", json={"email": e1, "password": "Pass@1234", "display_name": "R1"}).json()
    u2 = api_client.post(f"{base_url}/api/auth/register", json={"email": e2, "password": "Pass@1234", "display_name": "R2"}).json()
    h1 = auth_headers(u1["access_token"])
    before = api_client.get(f"{base_url}/api/users/{u2['user']['id']}", headers=h1).json()["trust_score"]
    r = api_client.post(f"{base_url}/api/report",
                       json={"target_id": u2["user"]["id"], "reason": "spam"}, headers=h1)
    assert r.status_code == 200
    after = api_client.get(f"{base_url}/api/users/{u2['user']['id']}", headers=h1).json()["trust_score"]
    assert after == before - 3


# --------- Admin ---------
def test_admin_stats_forbidden_for_non_admin(api_client, base_url, ava_auth):
    h = auth_headers(ava_auth["access_token"])
    r = api_client.get(f"{base_url}/api/admin/stats", headers=h)
    assert r.status_code == 403


def test_admin_stats_ok_for_admin(api_client, base_url, admin_auth):
    h = auth_headers(admin_auth["access_token"])
    r = api_client.get(f"{base_url}/api/admin/stats", headers=h)
    assert r.status_code == 200
    body = r.json()
    for key in ("users", "matches", "messages", "reports", "premium_users"):
        assert key in body
