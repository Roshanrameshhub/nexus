# Nexus — Proof-Based Verification Audit

**Date:** 2026-05-31  
**Method:** Source inspection + `npm run build` + pytest (where environment allows)  
**Backend live test:** Not run — `http://localhost:8000/health` unreachable during audit

---

## 1. Authentication issues found (verified in code)

| Issue | Evidence | Fix applied |
|-------|----------|-------------|
| **AuthProvider called `/users/me` on login/signup** | `auth-provider.tsx` ran on every route when `token` existed → extra API + 401 refresh logic | Skip hydration on public paths (`/`, `/login`, `/signup`, `/forgot-password`, `/reset-password`) |
| **Refresh token UUID bug** | `auth.py` compared `User.id == user_id` (string from JWT) | Cast to `UUID(str(user_id))` |
| **Google OAuth missing refresh token** | `google-sign-in-button.tsx` only passed `access_token` to `setAuth` | Pass `data.refresh_token` |
| **Google errors opaque** | Generic catch message | Surface FastAPI `detail` via axios |
| **Forgot password 404** | No `app/forgot-password/page.tsx` | Created `/forgot-password` + `/reset-password` |
| **No reset API** | No routes in `auth.py` | `POST /auth/forgot-password`, `POST /auth/reset-password` |
| **Login/signup slow (likely)** | framer-motion + fixed orbs + sync Google GSI script on mount | Login: removed motion/orbs; dynamic import Google; AuthProvider skip |

**Not live-tested:** signup/login against running API (backend was down).

---

## 2. Google OAuth issues found

| Check | Result |
|-------|--------|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in `.env.local` | Present (matches example) |
| `GOOGLE_CLIENT_ID` in `backend/.env` | Present (same client ID) |
| Frontend payload | `authAPI.google(credential)` → `{ id_token }` — **correct** |
| Backend verification | `id_token.verify_oauth2_token(..., settings.GOOGLE_CLIENT_ID)` — **correct** |
| GIS script | Loaded async in `GoogleSignInButton` | 
| Missing refresh on Google login | **Fixed** |

**Root cause if still broken in browser:** Google Cloud Console must allow `http://localhost:3000` as authorized JavaScript origin; backend must be running for token exchange.

---

## 3. Forgot password issues found

| Before | After |
|--------|-------|
| Link to `/forgot-password` → **404** | Page exists |
| No backend endpoints | `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` |
| No email | `send_password_reset_email` via Resend |
| No DB fields | `password_reset_token`, `password_reset_expires` on `User` |

**Action required:** If DB was created before this audit, run:

`backend/scripts/add_password_reset_columns.sql`

---

## 4. Mock / hardcoded data still present

| File | Line(s) | Type | Status |
|------|---------|------|--------|
| `FRONTEND/app/page.tsx` | 331–351 (old) | Fake communities (12.5K members, etc.) | **Removed** — uses `GET /communities` |
| `FRONTEND/app/page.tsx` | 36–40 (old) | `fallbackSpotlight` fake users | **Removed** — empty state when no posts |
| `FRONTEND/app/page.tsx` | 253–290 | Marketing feature copy | **Intentional** product copy (not API data) |
| `FRONTEND/app/signup/page.tsx` | 108–115 | Heavy animation orbs | Still present (perf risk on signup) |
| `backend/app/services/news_service.py` | (if present) | GNews placeholder without API key | Server-side fallback only |

---

## 5. Slow pages (code-level analysis)

| Page | Before (likely causes) | After changes |
|------|------------------------|---------------|
| Login | AuthProvider `me()`, framer-motion, Google script sync | Lighter layout + dynamic Google + no `me()` on `/login` |
| Signup | Same + 3-step motion UI | Dynamic Google only; motion/orbs remain |
| Landing | `GET /posts` + `GET /communities` on mount | Same (2 API calls); mock removed |

**Measured timings:** Not captured — backend was not running. Re-test with DevTools Performance after starting API.

---

## 6. API / build verification

| Command | Result |
|---------|--------|
| `npm run build` | **PASS** — includes `/forgot-password`, `/reset-password` |
| `pytest` | Requires `pip install -r requirements.txt` in backend venv |
| Live E2E | **Blocked** — backend not reachable at audit time |

---

## 7. Backend routes verified (file existence)

| Route | File | Verified |
|-------|------|----------|
| `POST /auth/signup` | `routes/auth.py` | Yes |
| `POST /auth/login` | `routes/auth.py` | Yes |
| `POST /auth/logout` | `routes/auth.py` | Yes |
| `POST /auth/google` | `routes/auth.py` | Yes |
| `POST /auth/refresh` | `routes/auth.py` | Yes |
| `POST /auth/forgot-password` | `routes/auth.py` | **Added** |
| `POST /auth/reset-password` | `routes/auth.py` | **Added** |
| `GET /communities` | `routes/communities.py` | Yes (landing uses this) |

---

## 8. Files modified this audit

**Backend:** `models/user.py`, `routes/auth.py`, `schemas/auth.py`, `services/email_service.py`, `config/settings.py`, `.env`, `.env.example`, `tests/test_api.py`, `scripts/add_password_reset_columns.sql`

**Frontend:** `lib/providers/auth-provider.tsx`, `services/api.ts`, `components/auth/google-sign-in-button.tsx`, `app/login/page.tsx`, `app/signup/page.tsx`, `app/page.tsx`, `app/forgot-password/page.tsx`, `app/reset-password/page.tsx`

---

## 9. Tests executed

| Test | Status |
|------|--------|
| `npm run build` | 7 routes, exit 0 |
| `pytest tests/test_api.py` | Run after `pip install -r requirements.txt` |
| Manual login/signup/OAuth | **Not run** (backend down) |

---

## 10. Production readiness: **~72%**

Improved auth/forgot-password/landing honesty; still needs live E2E with PostgreSQL + running API, signup perf pass, rate limiting, and Alembic migrations for reset columns.

---

## 11. What you should run now

```bash
# 1. DB columns (if users table already exists)
psql -d nexus -f backend/scripts/add_password_reset_columns.sql

# 2. Backend
cd backend && uvicorn app.main:app --reload --port 8000

# 3. Frontend (restart dev server)
cd FRONTEND && npm run dev

# 4. Verify
# - http://localhost:3000/forgot-password (not 404)
# - Login DevTools: no /users/me on first paint
# - POST /api/auth/login with valid user
# - Google sign-in with matching client IDs
```
