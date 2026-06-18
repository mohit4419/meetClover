"""Flick - AI-Powered Social Video Chat Backend.

FastAPI + MongoDB. JWT auth, swipe/match, chat, video-lobby matchmaking,
AI moderation + translation via Gemini (Emergent LLM key).
"""

from __future__ import annotations

import asyncio
import logging
import os
import random
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional

import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, APIRouter, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

import json
import re

from emergentintegrations.llm.chat import LlmChat, UserMessage


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("flick")

# ── Config ────────────────────────────────────────────────────────────────────
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
ACCESS_MIN = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))
REFRESH_DAYS = int(os.environ.get("REFRESH_TOKEN_EXPIRE_DAYS", "30"))
ADMIN_EMAIL = os.environ["ADMIN_EMAIL"]
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]
EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
users_c = db.users
swipes_c = db.swipes
matches_c = db.matches
messages_c = db.messages
queue_c = db.video_queue
reports_c = db.reports

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer(auto_error=False)

app = FastAPI(title="Flick API")
api = APIRouter(prefix="/api")


# ── Utils ─────────────────────────────────────────────────────────────────────
def now() -> datetime:
    return datetime.now(timezone.utc)


def hash_pw(p: str) -> str:
    return pwd_ctx.hash(p)


def verify_pw(p: str, h: str) -> bool:
    try:
        return pwd_ctx.verify(p, h)
    except Exception:
        return False


def make_token(uid: str, kind: str) -> str:
    delta = (
        timedelta(minutes=ACCESS_MIN)
        if kind == "access"
        else timedelta(days=REFRESH_DAYS)
    )
    payload = {
        "sub": uid,
        "type": kind,
        "exp": now() + delta,
        "iat": now(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Invalid token: {e}")


async def current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    if not creds:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing auth")
    payload = decode_token(creds.credentials)
    if payload.get("type") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Bad token type")
    uid = payload.get("sub")
    user = await users_c.find_one({"id": uid}, {"_id": 0, "hashed_password": 0})
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return user


# ── Models ────────────────────────────────────────────────────────────────────
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    display_name: str = Field(min_length=1, max_length=50)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class RefreshIn(BaseModel):
    refresh_token: str


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    user: dict


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None  # male/female/other
    country: Optional[str] = None
    languages: Optional[List[str]] = None
    interests: Optional[List[str]] = None
    bio: Optional[str] = None
    photos: Optional[List[str]] = None  # base64 data URIs
    preferred_language: Optional[str] = None


class SwipeIn(BaseModel):
    target_id: str
    action: str  # "like" | "pass" | "super"


class ChatSendIn(BaseModel):
    match_id: str
    text: str
    translate_to: Optional[str] = None


class ModerateIn(BaseModel):
    text: str


class TranslateIn(BaseModel):
    text: str
    target_language: str


class VideoStartIn(BaseModel):
    interests: Optional[List[str]] = None
    country: Optional[str] = None


class VideoEndIn(BaseModel):
    session_id: str


class ReportIn(BaseModel):
    target_id: str
    reason: str
    context: Optional[str] = None


class SubscribeIn(BaseModel):
    plan: str  # free | premium | premium_plus


# ── AI helpers ────────────────────────────────────────────────────────────────
async def ai_moderate(text: str) -> dict:
    """Return {allowed: bool, reason: str, severity: low|medium|high}."""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"mod-{uuid.uuid4()}",
            system_message=(
                "You are a strict but fair content-moderation classifier for a "
                "social chat app. Categories to block: hate speech, sexual harassment, "
                "explicit sexual content, threats, doxxing, scam/spam. "
                "Respond ONLY with compact JSON: "
                '{"allowed": true|false, "reason": "<short>", "severity": "low|medium|high"}. '
                "If safe, allowed=true, reason='ok', severity='low'."
            ),
        ).with_model("gemini", "gemini-2.5-flash")
        reply = await chat.send_message(UserMessage(text=f"Classify: {text}"))
        m = re.search(r"\{.*\}", reply, re.S)
        data = json.loads(m.group(0)) if m else {"allowed": True, "reason": "ok", "severity": "low"}
        return {
            "allowed": bool(data.get("allowed", True)),
            "reason": str(data.get("reason", "ok")),
            "severity": str(data.get("severity", "low")),
        }
    except Exception as e:
        logger.warning("moderation failed, allow-by-default: %s", e)
        return {"allowed": True, "reason": "moderation-unavailable", "severity": "low"}


async def ai_translate(text: str, target: str) -> dict:
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"tr-{uuid.uuid4()}",
            system_message=(
                "You are a translation engine. Detect the source language and translate "
                f"the user text into language code '{target}'. Respond ONLY in JSON: "
                '{"translated_text":"...","detected_language":"<iso>"}.'
            ),
        ).with_model("gemini", "gemini-2.5-flash")
        reply = await chat.send_message(UserMessage(text=text))
        m = re.search(r"\{.*\}", reply, re.S)
        data = json.loads(m.group(0)) if m else {"translated_text": text, "detected_language": "unknown"}
        return {
            "translated_text": str(data.get("translated_text", text)),
            "detected_language": str(data.get("detected_language", "unknown")),
        }
    except Exception as e:
        logger.warning("translate failed: %s", e)
        return {"translated_text": text, "detected_language": "unknown"}


# ── Public user shape ─────────────────────────────────────────────────────────
def public_user(u: dict) -> dict:
    return {
        "id": u.get("id"),
        "email": u.get("email"),
        "display_name": u.get("display_name"),
        "age": u.get("age"),
        "gender": u.get("gender"),
        "country": u.get("country"),
        "languages": u.get("languages", []),
        "interests": u.get("interests", []),
        "bio": u.get("bio", ""),
        "photos": u.get("photos", []),
        "trust_score": u.get("trust_score", 80),
        "verified": u.get("verified", False),
        "subscription_tier": u.get("subscription_tier", "free"),
        "coins": u.get("coins", 50),
        "is_admin": u.get("is_admin", False),
        "preferred_language": u.get("preferred_language", "en"),
        "referral_code": u.get("referral_code"),
    }


# ── Routes: meta ──────────────────────────────────────────────────────────────
@api.get("/")
async def root():
    return {"app": "Flick", "ok": True}


# ── Routes: auth ──────────────────────────────────────────────────────────────
@api.post("/auth/register", response_model=TokenOut, status_code=201)
async def register(payload: RegisterIn):
    if await users_c.find_one({"email": payload.email}):
        raise HTTPException(400, "Email already registered")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid,
        "email": payload.email,
        "display_name": payload.display_name,
        "hashed_password": hash_pw(payload.password),
        "is_admin": False,
        "subscription_tier": "free",
        "trust_score": 80,
        "verified": False,
        "coins": 50,
        "photos": [],
        "interests": [],
        "languages": ["en"],
        "preferred_language": "en",
        "referral_code": uid[:6].upper(),
        "created_at": now(),
    }
    await users_c.insert_one(doc)
    return TokenOut(
        access_token=make_token(uid, "access"),
        refresh_token=make_token(uid, "refresh"),
        user=public_user(doc),
    )


@api.post("/auth/login", response_model=TokenOut)
async def login(payload: LoginIn):
    u = await users_c.find_one({"email": payload.email})
    if not u or not verify_pw(payload.password, u["hashed_password"]):
        raise HTTPException(401, "Invalid credentials")
    return TokenOut(
        access_token=make_token(u["id"], "access"),
        refresh_token=make_token(u["id"], "refresh"),
        user=public_user(u),
    )


@api.post("/auth/refresh", response_model=TokenOut)
async def refresh(payload: RefreshIn):
    data = decode_token(payload.refresh_token)
    if data.get("type") != "refresh":
        raise HTTPException(401, "Bad token type")
    uid = data["sub"]
    u = await users_c.find_one({"id": uid})
    if not u:
        raise HTTPException(404, "User not found")
    return TokenOut(
        access_token=make_token(uid, "access"),
        refresh_token=make_token(uid, "refresh"),
        user=public_user(u),
    )


@api.get("/auth/me")
async def me(user: dict = Depends(current_user)):
    return public_user(user)


# ── Routes: profile ───────────────────────────────────────────────────────────
@api.put("/profile")
async def update_profile(payload: ProfileUpdate, user: dict = Depends(current_user)):
    upd = {k: v for k, v in payload.model_dump().items() if v is not None}
    if upd:
        await users_c.update_one({"id": user["id"]}, {"$set": upd})
    u = await users_c.find_one({"id": user["id"]})
    return public_user(u)


@api.get("/users/{uid}")
async def get_user(uid: str, user: dict = Depends(current_user)):
    u = await users_c.find_one({"id": uid})
    if not u:
        raise HTTPException(404, "Not found")
    return public_user(u)


# ── Routes: discover & swipe ──────────────────────────────────────────────────
@api.get("/discover")
async def discover(
    gender: Optional[str] = None,
    country: Optional[str] = None,
    limit: int = 30,
    user: dict = Depends(current_user),
):
    # exclude self + already-swiped
    swiped = await swipes_c.distinct("target_id", {"user_id": user["id"]})
    q = {"id": {"$nin": swiped + [user["id"]]}}
    if gender:
        q["gender"] = gender
    if country:
        q["country"] = country
    cursor = users_c.find(q, {"_id": 0, "hashed_password": 0}).limit(limit)
    items = [public_user(u) async for u in cursor]
    random.shuffle(items)
    # Sort by overlap of interests
    my_int = set(user.get("interests") or [])
    items.sort(
        key=lambda x: len(my_int.intersection(set(x.get("interests") or []))),
        reverse=True,
    )
    return {"items": items}


@api.post("/swipe")
async def swipe(payload: SwipeIn, user: dict = Depends(current_user)):
    if payload.target_id == user["id"]:
        raise HTTPException(400, "Cannot swipe self")
    if payload.action not in ("like", "pass", "super"):
        raise HTTPException(400, "Bad action")
    target = await users_c.find_one({"id": payload.target_id})
    if not target:
        raise HTTPException(404, "Target not found")

    await swipes_c.update_one(
        {"user_id": user["id"], "target_id": payload.target_id},
        {"$set": {"action": payload.action, "at": now()}},
        upsert=True,
    )

    match = None
    if payload.action in ("like", "super"):
        reverse = await swipes_c.find_one(
            {"user_id": payload.target_id, "target_id": user["id"], "action": {"$in": ["like", "super"]}}
        )
        if reverse:
            mid = str(uuid.uuid4())
            match_doc = {
                "id": mid,
                "user_a": user["id"],
                "user_b": payload.target_id,
                "created_at": now(),
                "last_message_at": now(),
            }
            # avoid duplicate
            existing = await matches_c.find_one(
                {
                    "$or": [
                        {"user_a": user["id"], "user_b": payload.target_id},
                        {"user_a": payload.target_id, "user_b": user["id"]},
                    ]
                }
            )
            if not existing:
                await matches_c.insert_one(match_doc)
                match = {
                    "id": mid,
                    "user_a": user["id"],
                    "user_b": payload.target_id,
                    "other_user": public_user(target),
                }
            else:
                match = {
                    "id": existing["id"],
                    "user_a": existing["user_a"],
                    "user_b": existing["user_b"],
                    "other_user": public_user(target),
                }
    return {"ok": True, "match": match}


@api.post("/swipe/undo")
async def swipe_undo(user: dict = Depends(current_user)):
    last = await swipes_c.find_one(
        {"user_id": user["id"]}, sort=[("at", -1)]
    )
    if not last:
        return {"ok": True}
    await swipes_c.delete_one({"_id": last["_id"]})
    return {"ok": True, "undone": last.get("target_id")}


# ── Routes: matches & chat ────────────────────────────────────────────────────
@api.get("/matches")
async def list_matches(user: dict = Depends(current_user)):
    cursor = matches_c.find(
        {"$or": [{"user_a": user["id"]}, {"user_b": user["id"]}]},
        {"_id": 0},
    ).sort("last_message_at", -1)
    out = []
    async for m in cursor:
        other_id = m["user_b"] if m["user_a"] == user["id"] else m["user_a"]
        other = await users_c.find_one({"id": other_id}, {"_id": 0, "hashed_password": 0})
        last_msg = await messages_c.find_one(
            {"match_id": m["id"]}, sort=[("created_at", -1)], projection={"_id": 0}
        )
        out.append(
            {
                "id": m["id"],
                "other_user": public_user(other) if other else None,
                "last_message": last_msg,
                "last_message_at": m.get("last_message_at"),
            }
        )
    return {"items": out}


@api.get("/chat/{match_id}/messages")
async def chat_messages(match_id: str, user: dict = Depends(current_user)):
    m = await matches_c.find_one({"id": match_id})
    if not m or user["id"] not in (m["user_a"], m["user_b"]):
        raise HTTPException(404, "Match not found")
    cursor = messages_c.find({"match_id": match_id}, {"_id": 0}).sort("created_at", 1)
    return {"items": [doc async for doc in cursor]}


@api.post("/chat/send")
async def chat_send(payload: ChatSendIn, user: dict = Depends(current_user)):
    m = await matches_c.find_one({"id": payload.match_id})
    if not m or user["id"] not in (m["user_a"], m["user_b"]):
        raise HTTPException(404, "Match not found")
    moderation = await ai_moderate(payload.text)
    if not moderation["allowed"]:
        # Penalize trust score on high severity
        if moderation.get("severity") == "high":
            await users_c.update_one({"id": user["id"]}, {"$inc": {"trust_score": -5}})
        return {"ok": False, "blocked": True, "moderation": moderation}

    translated = None
    if payload.translate_to:
        translated = await ai_translate(payload.text, payload.translate_to)

    msg = {
        "id": str(uuid.uuid4()),
        "match_id": payload.match_id,
        "sender_id": user["id"],
        "text": payload.text,
        "translated": translated,
        "created_at": now(),
    }
    await messages_c.insert_one(msg)
    await matches_c.update_one({"id": payload.match_id}, {"$set": {"last_message_at": now()}})
    msg.pop("_id", None)
    return {"ok": True, "message": msg, "moderation": moderation}


# ── Routes: AI ────────────────────────────────────────────────────────────────
@api.post("/ai/moderate")
async def moderate(payload: ModerateIn, user: dict = Depends(current_user)):
    return await ai_moderate(payload.text)


@api.post("/ai/translate")
async def translate(payload: TranslateIn, user: dict = Depends(current_user)):
    return await ai_translate(payload.text, payload.target_language)


# ── Routes: video chat lobby (signaling-lite) ─────────────────────────────────
@api.post("/video/start")
async def video_start(payload: VideoStartIn, user: dict = Depends(current_user)):
    """Match a user with another waiting peer or enqueue."""
    # cleanup stale (>60s)
    await queue_c.delete_many({"enqueued_at": {"$lt": now() - timedelta(seconds=60)}})
    other = await queue_c.find_one_and_delete(
        {"user_id": {"$ne": user["id"]}}
    )
    if other:
        peer = await users_c.find_one({"id": other["user_id"]}, {"_id": 0, "hashed_password": 0})
        sid = str(uuid.uuid4())
        return {"matched": True, "session_id": sid, "peer": public_user(peer) if peer else None}
    await queue_c.update_one(
        {"user_id": user["id"]},
        {"$set": {"user_id": user["id"], "enqueued_at": now(), "filters": payload.model_dump()}},
        upsert=True,
    )
    return {"matched": False, "session_id": None, "peer": None}


@api.post("/video/end")
async def video_end(payload: VideoEndIn, user: dict = Depends(current_user)):
    await queue_c.delete_one({"user_id": user["id"]})
    return {"ok": True}


@api.post("/video/cancel")
async def video_cancel(user: dict = Depends(current_user)):
    await queue_c.delete_one({"user_id": user["id"]})
    return {"ok": True}


# ── Routes: subscription / wallet ─────────────────────────────────────────────
@api.post("/subscription")
async def subscribe(payload: SubscribeIn, user: dict = Depends(current_user)):
    if payload.plan not in ("free", "premium", "premium_plus"):
        raise HTTPException(400, "Bad plan")
    await users_c.update_one(
        {"id": user["id"]},
        {"$set": {"subscription_tier": payload.plan, "verified": payload.plan != "free"}},
    )
    u = await users_c.find_one({"id": user["id"]})
    return public_user(u)


@api.post("/wallet/buy/{pack}")
async def buy_coins(pack: str, user: dict = Depends(current_user)):
    packs = {"small": 100, "medium": 500, "large": 1200, "mega": 3000}
    if pack not in packs:
        raise HTTPException(400, "Bad pack")
    await users_c.update_one({"id": user["id"]}, {"$inc": {"coins": packs[pack]}})
    u = await users_c.find_one({"id": user["id"]})
    return public_user(u)


# ── Routes: reports ───────────────────────────────────────────────────────────
@api.post("/report")
async def report(payload: ReportIn, user: dict = Depends(current_user)):
    rid = str(uuid.uuid4())
    await reports_c.insert_one(
        {
            "id": rid,
            "reporter_id": user["id"],
            "target_id": payload.target_id,
            "reason": payload.reason,
            "context": payload.context,
            "created_at": now(),
        }
    )
    # Penalize target trust score
    await users_c.update_one({"id": payload.target_id}, {"$inc": {"trust_score": -3}})
    return {"ok": True, "id": rid}


# ── Routes: admin-lite analytics ──────────────────────────────────────────────
@api.get("/admin/stats")
async def admin_stats(user: dict = Depends(current_user)):
    if not user.get("is_admin"):
        raise HTTPException(403, "Admin only")
    return {
        "users": await users_c.count_documents({}),
        "matches": await matches_c.count_documents({}),
        "messages": await messages_c.count_documents({}),
        "reports": await reports_c.count_documents({}),
        "premium_users": await users_c.count_documents({"subscription_tier": {"$ne": "free"}}),
    }


# ── Seed ──────────────────────────────────────────────────────────────────────
DEMO_PHOTOS = [
    "https://images.unsplash.com/photo-1662850886700-4ec19bd30d11?w=600&q=80",
    "https://images.pexels.com/photos/6605420/pexels-photo-6605420.jpeg?w=600",
    "https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?w=600&q=80",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&q=80",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&q=80",
    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=600&q=80",
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&q=80",
    "https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=600&q=80",
]

DEMO_USERS = [
    ("Ava", "ava@flick.app", 24, "female", "USA", ["en", "es"], ["music", "travel", "art"], "Sunset chaser & vinyl collector."),
    ("Liam", "liam@flick.app", 27, "male", "UK", ["en"], ["football", "gaming", "coffee"], "Football & lo-fi beats."),
    ("Mei", "mei@flick.app", 22, "female", "Japan", ["ja", "en"], ["anime", "ramen", "photography"], "Tokyo cafés > everything."),
    ("Diego", "diego@flick.app", 29, "male", "Spain", ["es", "en"], ["surfing", "tapas", "salsa"], "Salsa nights and tapas."),
    ("Nour", "nour@flick.app", 26, "female", "UAE", ["ar", "en"], ["fashion", "art", "yoga"], "Desert sunsets and good vibes."),
    ("Hiro", "hiro@flick.app", 25, "male", "Japan", ["ja", "en"], ["anime", "tech", "ramen"], "Building cool stuff at 3am."),
    ("Sofia", "sofia@flick.app", 23, "female", "Brazil", ["pt", "en", "es"], ["dance", "samba", "beach"], "Catch me at Copacabana."),
    ("Arjun", "arjun@flick.app", 28, "male", "India", ["hi", "en"], ["cricket", "biryani", "tech"], "Code by day, biryani by night."),
]


async def seed():
    if await users_c.find_one({"email": ADMIN_EMAIL}) is None:
        uid = str(uuid.uuid4())
        await users_c.insert_one(
            {
                "id": uid,
                "email": ADMIN_EMAIL,
                "display_name": "Admin",
                "hashed_password": hash_pw(ADMIN_PASSWORD),
                "is_admin": True,
                "subscription_tier": "premium_plus",
                "trust_score": 100,
                "verified": True,
                "coins": 9999,
                "photos": [],
                "interests": ["safety", "moderation"],
                "languages": ["en"],
                "preferred_language": "en",
                "referral_code": "ADMIN1",
                "created_at": now(),
            }
        )
        logger.info("Seeded admin %s", ADMIN_EMAIL)
    for i, (name, email, age, gender, country, langs, ints, bio) in enumerate(DEMO_USERS):
        if await users_c.find_one({"email": email}):
            continue
        uid = str(uuid.uuid4())
        await users_c.insert_one(
            {
                "id": uid,
                "email": email,
                "display_name": name,
                "hashed_password": hash_pw("Demo@1234"),
                "is_admin": False,
                "subscription_tier": "free",
                "trust_score": random.randint(70, 98),
                "verified": random.random() > 0.4,
                "coins": 50,
                "photos": [DEMO_PHOTOS[i % len(DEMO_PHOTOS)]],
                "interests": ints,
                "languages": langs,
                "preferred_language": langs[0],
                "age": age,
                "gender": gender,
                "country": country,
                "bio": bio,
                "referral_code": uid[:6].upper(),
                "created_at": now(),
            }
        )
    logger.info("Seed complete: %s users", await users_c.count_documents({}))


@app.on_event("startup")
async def on_startup():
    asyncio.create_task(seed())


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
