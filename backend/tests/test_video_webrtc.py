"""Iteration 3 backend tests: real WebRTC signaling — REST + WebSocket /api/ws/signal."""
import asyncio
import json
import uuid

import pytest
import requests
import websockets


def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _register(api_client, base_url, prefix="vid"):
    e = f"TEST_{prefix}_{uuid.uuid4().hex[:6]}@flick.app"
    r = api_client.post(
        f"{base_url}/api/auth/register",
        json={"email": e, "password": "Pass@1234", "display_name": prefix.upper()},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    return r.json()


def _ws_url(base_url: str) -> str:
    if base_url.startswith("https://"):
        return "wss://" + base_url[len("https://"):]
    if base_url.startswith("http://"):
        return "ws://" + base_url[len("http://"):]
    return base_url


# ────── REST /video/start, /video/poll, /video/cancel, /video/end ──────
def test_video_start_first_caller_is_queued(api_client, base_url):
    u = _register(api_client, base_url, "vs1")
    h = auth_headers(u["access_token"])
    # cleanup just in case
    api_client.post(f"{base_url}/api/video/cancel", headers=h, timeout=30)
    r = api_client.post(f"{base_url}/api/video/start", json={}, headers=h, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["matched"] is False
    assert body["session_id"] is None
    assert body["role"] is None
    assert body["peer"] is None
    assert isinstance(body["ice_servers"], list) and len(body["ice_servers"]) >= 1
    # STUN must be present
    urls = [s.get("urls") for s in body["ice_servers"]]
    assert any("stun:" in (u or "") for u in urls)
    # cleanup
    api_client.post(f"{base_url}/api/video/cancel", headers=h, timeout=30)


def test_video_start_second_user_is_matched_as_caller(api_client, base_url):
    a = _register(api_client, base_url, "vsA")
    b = _register(api_client, base_url, "vsB")
    ha, hb = auth_headers(a["access_token"]), auth_headers(b["access_token"])
    # ensure clean
    api_client.post(f"{base_url}/api/video/cancel", headers=ha, timeout=30)
    api_client.post(f"{base_url}/api/video/cancel", headers=hb, timeout=30)

    r1 = api_client.post(f"{base_url}/api/video/start", json={}, headers=ha, timeout=30)
    assert r1.status_code == 200
    assert r1.json()["matched"] is False

    r2 = api_client.post(f"{base_url}/api/video/start", json={}, headers=hb, timeout=30)
    assert r2.status_code == 200, r2.text
    body = r2.json()
    assert body["matched"] is True
    assert body["session_id"], "session_id must be set when matched"
    assert body["role"] == "caller"
    assert body["peer"] is not None
    assert body["peer"]["id"] == a["user"]["id"]
    assert isinstance(body["ice_servers"], list)
    sid = body["session_id"]

    # poll on the waiting user A should now return matched callee
    r3 = api_client.post(f"{base_url}/api/video/poll", headers=ha, timeout=30)
    assert r3.status_code == 200
    pb = r3.json()
    assert pb["matched"] is True
    assert pb["session_id"] == sid
    assert pb["role"] == "callee"
    assert pb["peer"]["id"] == b["user"]["id"]

    # end -> cleanup
    re = api_client.post(f"{base_url}/api/video/end", json={"session_id": sid}, headers=hb, timeout=30)
    assert re.status_code == 200
    assert re.json()["ok"] is True

    # after end, polling should yield matched=false for either
    pa = api_client.post(f"{base_url}/api/video/poll", headers=ha, timeout=30).json()
    pb2 = api_client.post(f"{base_url}/api/video/poll", headers=hb, timeout=30).json()
    assert pa["matched"] is False
    assert pb2["matched"] is False


def test_video_cancel_removes_from_queue(api_client, base_url):
    a = _register(api_client, base_url, "vcA")
    b = _register(api_client, base_url, "vcB")
    ha, hb = auth_headers(a["access_token"]), auth_headers(b["access_token"])
    # enqueue A
    r1 = api_client.post(f"{base_url}/api/video/start", json={}, headers=ha, timeout=30)
    assert r1.json()["matched"] is False
    # cancel A
    rc = api_client.post(f"{base_url}/api/video/cancel", headers=ha, timeout=30)
    assert rc.status_code == 200 and rc.json()["ok"] is True
    # B starts -> should NOT find A anymore -> queued
    r2 = api_client.post(f"{base_url}/api/video/start", json={}, headers=hb, timeout=30)
    assert r2.json()["matched"] is False
    api_client.post(f"{base_url}/api/video/cancel", headers=hb, timeout=30)


# ────── WebSocket /api/ws/signal ──────
@pytest.mark.asyncio
async def test_ws_signal_rejects_bad_token(base_url):
    url = _ws_url(base_url) + "/api/ws/signal?token=garbage&session_id=nonexistent"
    async with websockets.connect(url) as ws:
        msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
        assert msg.get("type") == "error"
        assert msg.get("reason") == "auth"
        # Server should close after error
        try:
            await asyncio.wait_for(ws.recv(), timeout=5)
        except (websockets.ConnectionClosed, asyncio.TimeoutError):
            pass


@pytest.mark.asyncio
async def test_ws_signal_rejects_bad_session(api_client, base_url):
    u = _register(api_client, base_url, "wsbs")
    token = u["access_token"]
    url = _ws_url(base_url) + f"/api/ws/signal?token={token}&session_id=does-not-exist"
    async with websockets.connect(url) as ws:
        msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
        assert msg.get("type") == "error"
        assert msg.get("reason") == "session"


@pytest.mark.asyncio
async def test_ws_full_handshake_offer_answer_ice_relay(api_client, base_url):
    """Two peers connect; A gets 'waiting', then both get 'peer-joined' when B joins.
    Then A->offer->B, B->answer->A, both ice candidates relayed, finally peer-left on disconnect."""
    a = _register(api_client, base_url, "wsA")
    b = _register(api_client, base_url, "wsB")
    ha, hb = auth_headers(a["access_token"]), auth_headers(b["access_token"])

    # cleanup
    api_client.post(f"{base_url}/api/video/cancel", headers=ha, timeout=30)
    api_client.post(f"{base_url}/api/video/cancel", headers=hb, timeout=30)

    # enqueue A
    r1 = api_client.post(f"{base_url}/api/video/start", json={}, headers=ha, timeout=30).json()
    assert r1["matched"] is False
    # B starts -> matched as caller with session_id
    r2 = api_client.post(f"{base_url}/api/video/start", json={}, headers=hb, timeout=30).json()
    assert r2["matched"] is True
    sid = r2["session_id"]
    assert r2["role"] == "caller"

    # A polls -> callee
    r3 = api_client.post(f"{base_url}/api/video/poll", headers=ha, timeout=30).json()
    assert r3["matched"] is True and r3["role"] == "callee" and r3["session_id"] == sid

    base_ws = _ws_url(base_url)
    url_a = f"{base_ws}/api/ws/signal?token={a['access_token']}&session_id={sid}"
    url_b = f"{base_ws}/api/ws/signal?token={b['access_token']}&session_id={sid}"

    async with websockets.connect(url_a) as ws_a:
        first_a = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=10))
        assert first_a["type"] == "waiting", f"got {first_a}"

        async with websockets.connect(url_b) as ws_b:
            # both should receive peer-joined
            ev_a = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=10))
            ev_b = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=10))
            assert ev_a["type"] == "peer-joined"
            assert ev_b["type"] == "peer-joined"

            # A (callee) sends offer to B (caller) — server is dumb relay, so any type relays
            fake_offer = {"type": "offer", "sdp": "v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\ns=-\r\n"}
            await ws_a.send(json.dumps(fake_offer))
            relayed = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=10))
            assert relayed["type"] == "offer"
            assert relayed["sdp"] == fake_offer["sdp"]

            # B sends answer -> A
            fake_answer = {"type": "answer", "sdp": "v=0\r\no=- 2 2 IN IP4 127.0.0.1\r\ns=-\r\n"}
            await ws_b.send(json.dumps(fake_answer))
            relayed2 = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=10))
            assert relayed2["type"] == "answer"
            assert relayed2["sdp"] == fake_answer["sdp"]

            # ICE
            ice_msg = {"type": "ice", "candidate": {"candidate": "candidate:1 1 udp 1 1.2.3.4 1 typ host", "sdpMid": "0", "sdpMLineIndex": 0}}
            await ws_a.send(json.dumps(ice_msg))
            relayed3 = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=10))
            assert relayed3["type"] == "ice"
            assert relayed3["candidate"]["sdpMid"] == "0"

        # ws_b closed -> A should receive peer-left
        try:
            ev = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=10))
            assert ev["type"] == "peer-left"
        except asyncio.TimeoutError:
            pytest.fail("peer-left was not delivered to ws_a after ws_b disconnected")

    # cleanup
    api_client.post(f"{base_url}/api/video/end", json={"session_id": sid}, headers=hb, timeout=30)


@pytest.mark.asyncio
async def test_video_end_notifies_peer_via_ws(api_client, base_url):
    a = _register(api_client, base_url, "endA")
    b = _register(api_client, base_url, "endB")
    ha, hb = auth_headers(a["access_token"]), auth_headers(b["access_token"])
    api_client.post(f"{base_url}/api/video/cancel", headers=ha, timeout=30)
    api_client.post(f"{base_url}/api/video/cancel", headers=hb, timeout=30)

    api_client.post(f"{base_url}/api/video/start", json={}, headers=ha, timeout=30)
    r2 = api_client.post(f"{base_url}/api/video/start", json={}, headers=hb, timeout=30).json()
    sid = r2["session_id"]
    assert sid

    base_ws = _ws_url(base_url)
    url_a = f"{base_ws}/api/ws/signal?token={a['access_token']}&session_id={sid}"
    url_b = f"{base_ws}/api/ws/signal?token={b['access_token']}&session_id={sid}"

    async with websockets.connect(url_a) as ws_a, websockets.connect(url_b) as ws_b:
        # drain initial 'waiting'/'peer-joined' messages
        await asyncio.wait_for(ws_a.recv(), timeout=10)
        # ws_a may receive waiting then peer-joined; drain until peer-joined
        try:
            await asyncio.wait_for(ws_a.recv(), timeout=2)
        except asyncio.TimeoutError:
            pass
        try:
            await asyncio.wait_for(ws_b.recv(), timeout=10)
        except asyncio.TimeoutError:
            pass

        # Now caller calls /video/end -> peer-left to opposite socket
        re = requests.post(
            f"{base_url}/api/video/end",
            json={"session_id": sid},
            headers=hb,
            timeout=30,
        )
        assert re.status_code == 200

        # one of the sockets should receive peer-left (the one that wasn't the caller)
        got_peer_left = False
        for ws in (ws_a, ws_b):
            try:
                msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
                if msg.get("type") == "peer-left":
                    got_peer_left = True
                    break
            except asyncio.TimeoutError:
                continue
        assert got_peer_left, "no peer-left after /video/end"
