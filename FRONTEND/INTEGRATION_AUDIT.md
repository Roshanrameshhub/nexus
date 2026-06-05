# Frontend ↔ Backend Integration — Final Report

**Date:** 2026-05-28  
**Backend:** Unchanged (FastAPI @ `http://localhost:8000/api`)  
**Frontend:** Next.js — mock data removed, API client fixed

---

## Phase 1 — Audit summary

| File | Issue | Resolution |
|------|--------|------------|
| `services/api.ts` | `baseURL` defaulted to `/api` → **localhost:3000** | Fixed via `getApiBaseUrl()` |
| `app/dashboard/page.tsx` | Mock feed, stats, users | `GET /dashboard`, `/news/trending-topics` |
| `app/feed/page.tsx` | Mock posts, people, hashtags | `GET /posts`, `/users/recommendations`, `/news/trending-topics` |
| `app/messages/page.tsx` | Mock conversations/messages | `GET/POST /conversations/*` |
| `app/notifications/page.tsx` | Mock notifications | `GET /notifications` |
| `app/notifications/page.tsx` | Connection requests | Empty (no backend route) |
| `app/news/page.tsx` | `generatePlaceholder*` | `GET /news/*` |
| `app/github/page.tsx` | Placeholder generators + hardcoded names | `GET /github/*` |
| `app/community/page.tsx` | Mock discussions | `GET /communities`, `.../discussions` |
| `app/workspace/page.tsx` | John Doe, mock tasks/files | Teams/channels API; tasks/files empty |
| `app/profile/page.tsx` | John Doe, hardcoded stats | `GET /users/me`, `/posts`, `/dashboard` |
| `app/startups/page.tsx` | Missing page | Created → `GET /startups` |
| `app/login|signup` | `setTimeout` fake auth | `POST /auth/login`, `/auth/signup` |
| `app/page.tsx` | Fake user names in marketing | `GET /posts` feed (or role fallbacks) |
| `services/news-api.ts` | Placeholder generators | **Not used by pages** (kept for types only) |
| `services/github-api.ts` | Placeholder generators | **Not used by pages** |

---

## Phase 2 — API client repair

**Root cause:** `process.env.NEXT_PUBLIC_API_URL || '/api'` sent requests to the Next dev server.

**Fix:**
- `lib/config/api.ts` → `getApiBaseUrl()` → `http://localhost:8000/api` when env unset
- `FRONTEND/.env.local` → `NEXT_PUBLIC_API_URL=http://localhost:8000/api`
- All services use shared `api` instance from `services/api.ts`

**Restart required:** After changing `.env.local`, restart `npm run dev`.

---

## Phase 3 — Auth

| Flow | Endpoint | Status |
|------|----------|--------|
| Signup | `POST /api/auth/signup` | ✅ |
| Login | `POST /api/auth/login` | ✅ |
| Logout | `POST /api/auth/logout` + `useLogout()` hook | ✅ (hook ready; wire buttons optional) |
| Session | Zustand + `GET /api/users/me` | ✅ |
| Google OAuth | `POST /api/auth/google` | Backend 501 until configured |
| GitHub OAuth | `GET /api/github/oauth/init` | ✅ redirect when keys set |
| Protected pages | `useProtectedRoute()` | ✅ |

---

## Phase 4 — Pages integrated

| Page | Endpoints |
|------|-----------|
| Dashboard | `/dashboard`, `/news/trending-topics` |
| Feed | `/posts`, `/users/recommendations`, `/news/trending-topics` |
| Messages | `/conversations`, `.../messages` |
| Notifications | `/notifications` |
| News | `/news/trending`, `/ai`, `/startups`, `/devto`, `/trending-topics`, etc. |
| GitHub | `/github/status`, `/profile`, `/repos`, `/contributions`, `/activity`, `/languages`, `/suggested-contributors` |
| Community | `/communities`, `.../discussions` |
| Workspace | `/teams`, `.../channels` |
| Startups | `/startups` |
| Profile | `/users/me`, `/posts`, `/dashboard` (stats) |
| Landing | `/posts` (public feed preview) |

---

## Phase 5 — Mock elimination

- No `mockData.ts` / `dummyData.ts` files existed
- `generatePlaceholder*` in `news-api.ts` / `github-api.ts` — **not imported by pages**
- Hardcoded **John Doe** removed from app pages (signup placeholder text `"John Doe"` is form hint only)
- Workspace tasks/milestones/files — **empty** (no backend); empty-state copy added

---

## Phase 6 — Types

- `lib/types/api.ts` — DTOs aligned with backend
- `lib/mappers/*` — view models for UI (no layout changes)

---

## Phase 7 — Validation checklist

| Check | Status |
|-------|--------|
| No mock feed/users on app pages | ✅ |
| API base URL not relative `/api` | ✅ |
| `.env.local` present | ✅ |
| Auth uses real endpoints | ✅ |
| UI layout unchanged | ✅ |
| WebSocket in messages UI | ⚠️ REST only (WS at `/api/ws` available) |

---

## Remaining backend gaps

1. ~~Connection requests~~ — **Implemented** (`/api/connections/*`, `/connections` page)
2. ~~Workspace tasks, milestones, files~~ — **Implemented** (`/api/workspaces`, `/api/tasks`, etc.)
3. Profile experience / achievements
4. Post share action
5. Discussion votes/views
6. Google OAuth (needs env keys)
7. Team member list with profiles
8. `POST /auth/refresh` — **Implemented** with silent token refresh
9. Post PATCH/DELETE — **Implemented**

---

## Files modified (this pass)

- `lib/config/api.ts` (new)
- `lib/hooks/use-logout.ts` (new)
- `FRONTEND/.env.local` (new)
- `services/api.ts`
- `app/page.tsx`, `workspace`, `news`, `github`, `profile`
- `INTEGRATION_AUDIT.md` (this file)

Plus prior integration: all `app/*/page.tsx`, `lib/store.ts`, `lib/types`, `lib/mappers`, `lib/hooks/use-protected-route.ts`, `app/startups/page.tsx`

---

## Run

```bash
# Backend (port 8000)
cd backend && uvicorn app.main:app --reload

# Frontend — restart after .env.local
cd FRONTEND && npm run dev
```

Verify in DevTools → Network: requests go to `http://localhost:8000/api/...`, not `:3000/api`.
