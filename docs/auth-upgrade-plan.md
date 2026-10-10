# AURA — Auth Upgrade Plan (password login + Google sign-in)

> **Status (2026-10-10):** Steps 0–3 done. Migration applied to prod DB (additive). Tests: contract 123/123,
> in-process Google 6/6 (`pnpm test:integration`), unit 22/22; web typecheck + `next build` clean.
> Next: Step 4 manual test (Shubham), then staging → prod.

> **Goal:** Keep OTP signup. Add three ways to **log in**: email + password (default), **Continue with Google**
> (One Tap: Google suggests the account already signed in to the browser), and "sign in with a code instead"
> (existing OTP). Web first; mobile in a later phase.
>
> **Rule:** existing endpoints keep working unchanged (the mobile app uses them today).

## 0. Decisions (locked)

| Topic | Decision |
|---|---|
| Order | **Web first**, mobile next |
| Mobile Google library | **Decide later** (check whether your EAS plan includes the paid "Universal" version of `@react-native-google-signin/google-signin`; otherwise free/deprecated SDK or browser flow) |
| New Google users | **Create the account** with Google's verified email; if the email already exists, **link** Google to that account |
| Google on web | Google Identity Services (GIS): One Tap prompt + "Sign in with Google" button. FedCM is automatic (`use_fedcm_for_prompt` is deprecated and ignored) |
| Token check | Backend verifies Google's **ID token** with `google-auth-library` `verifyIdToken({ idToken, audience })`; identity = `sub`; require `email_verified === true` |

## 1. What changes

### Database (additive only — safe while the current API is running)
`users` gets 3 columns:
- `google_id text UNIQUE NULL` — Google `sub`
- `failed_login_attempts integer NOT NULL DEFAULT 0`
- `locked_until timestamp NULL`

### API (new endpoints under `/api/auth`)
| Endpoint | Body | Behaviour |
|---|---|---|
| `POST /login/password` | `{ email, password }` | Success → same response + cookie as `/login`. Wrong email **or** password → `401 "Invalid email or password."` (no hint which). **5 failures → locked 15 min** → `429 "Too many failed attempts. Try again in N minutes, or sign in with a code."` Success resets the counter. Accounts with no password (Google-only) → same generic 401. |
| `POST /google` | `{ credential }` (GIS ID token) | Verify token (signature, `aud`, `iss`, `exp`) + `email_verified`. Find by `google_id` → log in. Else find by email → link `google_id`, log in. Else **create** user (username from email, e.g. `shubham` / `shubham_4821`; display name + avatar from Google; no password) → `{ token, user, isNewUser }` + cookie. Bad token → `401 "Google sign-in failed."` |
| `POST /forgot-password` | `{ email }` | Always `200 "If an account exists, we've sent a code."` (doesn't reveal accounts); sends a `password_reset` OTP if the user exists. |
| `POST /forgot-password/verify` | `{ email, otp }` | Step 2 of the web flow: checks the code (3 attempts) and marks it verified until it expires (15 min). |
| `POST /reset-password` | `{ email, otp?, newPassword }` | `otp` optional after `/forgot-password/verify` (verified, unexpired code required). Same OTP rules as today (3 attempts, 15 min). Sets password, clears lockout. **Also how Google-only users create a password.** |

Unchanged: `send-otp`, `verify-otp`, `signup`, `login` (OTP), `me`, `logout`, `become-creator`.

Also fixed: **account deletion for Google-only users** (they have no password to confirm with) → they confirm with an emailed OTP instead (`POST /api/profile/delete/otp` then `DELETE /api/profile` with `{ otp }`).

### Web (`apps/web`)
- `/login` redesign, same dark look:
  1. **Continue with Google** button + **One Tap** prompt on page load (suggests the signed-in Google account)
  2. Email + password form (default)
  3. Links: **Forgot password?** · **Sign in with a code instead** (existing OTP flow) · Sign up
- `/signup` keeps the OTP flow, plus a Google button.
- Forgot/reset password screens (email → code → new password).
- Profile: "Set a password" for Google-only accounts (uses the reset flow); delete-account confirms by code when there's no password.
- Env: `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (Vercel + `apps/web/.env.local`).

### Mobile (later phase)
Password login + "use a code instead" (easy, same endpoints). Google sign-in once the library decision is made
(needs an Android OAuth client with the app's SHA-1 from EAS credentials, and the **web** client ID as `serverClientId`).

## 2. Steps

### Step 0 — Google Cloud setup (Shubham, ~15 min)
- [x] Google Cloud Console → APIs & Services → **OAuth consent screen**: app name "Aurora", support email, logo, links to privacy/terms pages, publish.
- [x] **Credentials → Create OAuth client ID → Web application**. Authorized JavaScript origins:
  `https://www.aurora-walls.com`, `https://aurora-walls.com`, `http://localhost`, `http://localhost:3000`
- [x] Put the client ID in: Render `GOOGLE_CLIENT_ID` (prod + staging), Vercel `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, local `.env`, `.env.test`, `apps/web/.env.local`. (The client **secret** is not needed for ID-token sign-in.)

### Step 1 — Backend (Claude)
- [x] Migration: add the 3 columns (plain `ALTER TABLE … ADD COLUMN`, applied after a fresh `pg_dump`), models updated, offline drift check.
- [x] `integrations/google.ts` (`verifyGoogleIdToken`), `auth.service` (password login + lockout, Google find/link/create, forgot/reset), zod schemas, controllers, routes.
- [x] OTP-confirmed account deletion for passwordless users.

### Step 2 — Tests (Claude)
- [x] Contract: password login (success, wrong password, unknown email, Google-only account, lockout after 5, unlock after reset), forgot/reset (generic response, OTP rules, new password works), `/google` with invalid/expired token → 401, all old auth tests still green.
- [x] Unit (in-process, Google verifier mocked): new user created, existing email linked, existing `google_id` logs in, `email_verified=false` rejected, username collision handling.
- [x] Full suite + diff vs current prod for unchanged endpoints.

### Step 3 — Web UI (Claude)
- [x] GIS script + One Tap + button component, new `/login`, forgot/reset pages, profile changes. Typecheck + build.

### Step 4 — Manual test (Shubham) → Step 5 — Staging → prod (same flow as before)
- [ ] Google login on localhost and staging (staging origin added to Google client if testing there)
- [ ] Password login, lockout message, forgot password, OTP-instead, signup unchanged

### Step 6 — Mobile (later)
- [ ] Password + OTP-instead screens; Google once library is chosen.

## 3. Security notes
- Generic errors on login/forgot so attackers can't tell which emails exist (OTP `send-otp` still says "No account found" — kept for compatibility, can change later).
- Lockout is per account (DB), on top of the per-IP rate limit (100/min).
- Google tokens are only trusted after signature + audience verification on the server; `sub` (not email) is the stable identity.
