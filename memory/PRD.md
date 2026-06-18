# Flick — Product Requirements Document (MVP)

## Vision
Gen-Z global social video chat. Tinder-style swipe discovery + random video chat lobby + 1:1 text chat with **AI moderation** and **real-time translation** (Hindi, English, Spanish, French, German, Arabic, Japanese, Korean, Portuguese).

## Stack
- **Frontend**: Expo (React Native) + expo-router, neo-brutalist design (pink/yellow/blue, hard 3–6px shadows, bold typography).
- **Backend**: FastAPI + MongoDB (motor).
- **AI**: Emergent Universal LLM Key → Gemini 2.5 Flash for moderation + translation (via `emergentintegrations`).

## Features built
- JWT auth (register/login/refresh/me) with bcrypt.
- Onboarding (age, gender, country, interests, languages, bio, photo).
- Tinder swipe deck (PanResponder, like/pass/super, undo, match modal).
- Discover grid with horizontal chip filters (gender/country).
- Random video chat lobby (queue-based matchmaking; simulated "connected" UI with translation panel + moderation banner).
- 1:1 chat with AI moderation gating each send + optional translate-to-recipient-language.
- Subscription tiers (Free / Premium / Premium+) with mock upgrade.
- Wallet (coin packs purchase via API) and gifts catalog.
- Referral screen with code + copy.
- Profile (avatar/trust score/verified badge/interests, edit, logout).
- Admin-lite analytics for admin users (`/admin/stats`).
- Report user (decreases target trust score).

## Out-of-scope (v1)
- Real WebRTC peer-to-peer streaming (would require dev build + TURN server).
- OAuth (Google/Apple/Facebook) — currently email-password only.
- Real Stripe checkout (mocked tier upgrade).
- Voice notes, image sharing in chat.
- Face liveness verification (uses simple `verified` flag).

## Demo credentials
See `/app/memory/test_credentials.md`.
