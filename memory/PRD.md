# Flick — Product Requirements Document

## Vision
Gen-Z global social video chat. Tinder-style swipe + random video chat + 1:1 multimedia chat with AI moderation and real-time translation across 9 languages.

## Stack
- **Frontend**: Expo (React Native) + expo-router, neo-brutalist design (pink/yellow/blue, hard 3–6px shadows, bold typography).
- **Backend**: FastAPI + MongoDB (motor).
- **Integrations**:
  - Emergent Universal LLM Key → Gemini 2.5 Flash for moderation + translation.
  - Stripe Checkout (test mode) via `emergentintegrations.payments.stripe.checkout.StripeCheckout`.
  - Emergent-managed Google OAuth (session_id exchange at demobackend.emergentagent.com).

## Features (v1 + v2)
### Auth
- JWT email/password (bcrypt) — register, login, refresh, /me.
- Google sign-in via Emergent auth (`/auth/emergent/google` exchanges session_id for our JWT).

### Profile
- Onboarding (age, gender, country, interests, languages, bio).
- Multi-photo gallery, up to 6 photos (`expo-image-picker` on native, URL paste on web).

### Discovery
- Tinder swipe deck (like/pass/super, undo, match modal celebration).
- Discover grid with sticky horizontal chip filters (gender + country).

### Video chat
- Random video chat **lobby with queue matchmaking** and a connected screen with peer card, AI moderation banner, live translation panel.

### 1:1 Chat
- Text, **image (base64)**, and **voice notes** via `expo-audio` (record + playback).
- AI text moderation gates every text send; high-severity blocks dock trust score.
- Optional translate-to-recipient-language toggle.
- Filter chips on chat list (All / Unread / Verified / New Match).
- Unread badges per match; `/chat/read` resets count.

### Monetization
- 3 plans (Free / Premium $9.99 / Premium+ $19.99).
- **Real Stripe Checkout** in TEST mode — backend creates session, frontend opens hosted page (web redirect or `expo-web-browser` on native), and `/payment/return` polls `/payments/status` until `paid` then upgrades tier. Server also accepts `/webhook/stripe` for production.

### Other
- Wallet & gifts (mock coin purchase).
- Referral with copy-code (`expo-clipboard`).
- Admin-lite analytics for `is_admin=true` users.
- Report user (decreases target trust score).

## Demo credentials
See `/app/memory/test_credentials.md`. Stripe test card: `4242 4242 4242 4242`, any future date, any CVC.

## Out-of-scope (next)
- Real WebRTC peer-to-peer streaming (would require dev build + TURN server).
- Subscription recurring billing (currently one-time TEST payment that upgrades tier).
- OAuth providers beyond Google (Apple / Facebook).
- Face liveness verification (uses simple `verified` flag).
