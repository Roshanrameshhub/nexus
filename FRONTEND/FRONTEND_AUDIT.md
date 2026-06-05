# Frontend API Coverage Audit

**Date:** 2026-05-28  
**Backend:** FastAPI @ `/api` (64 REST endpoints, no backend changes)  
**Frontend:** Next.js 16 + TypeScript + Zustand + Axios

---

## Summary

| Metric | Before upgrade | Target |
|--------|----------------|--------|
| API methods in `services/` | ~55 / 64 (86%) | 64 / 64 |
| Endpoints wired in UI | ~38 / 64 (59%) | 64 / 64 |
| Dedicated pages | 15 | 26+ |
| React Query hooks | 0 | Full module coverage |

---

## Existing Features

### Pages (15)
| Route | Module | API usage |
|-------|--------|-----------|
| `/` | Landing | `GET /posts` |
| `/login`, `/signup` | Auth | signup, login, Google |
| `/dashboard` | Dashboard | dashboard, trending-topics |
| `/feed` | Posts | posts, recommendations, topics |
| `/messages` | Messaging | conversations, messages, WebSocket |
| `/notifications` | Notifications | list, mark all read |
| `/news` | News | trending, ai, startups, devto, topics |
| `/github` | GitHub | status, profile, repos, activity, etc. |
| `/github/callback` | GitHub OAuth | oauth callback |
| `/community` | Communities | list, discussions (aggregated) |
| `/workspace` | Teams | teams, channels |
| `/startups` | Startups | list only |
| `/profile` | Users | me, posts, dashboard stats |
| `/profile/complete` | Users | me, PATCH user |

### Components
- `components/auth/google-sign-in-button.tsx`
- `components/auth/logout-button.tsx`
- `components/ui/*` (shadcn)

### Services
- `services/api.ts` — auth, users, posts, messages, notifications, communities, teams, startups, dashboard
- `services/news-api.ts` — full news API surface
- `services/github-api.ts` — full GitHub API surface

### State
- Zustand: `useAuthStore`, `useUIStore`
- `useProtectedRoute`, `useLogout`, `useMessageSocket`

---

## Missing Features (pre-upgrade)

### Auth
- [x] Signup, login, logout, Google
- [ ] Central `AuthProvider` with session recovery
- [ ] Refresh token handling (tokens issued; no `/auth/refresh` in backend)

### Users
- [ ] `GET /users/search` — Discover page
- [ ] `GET /users/{id}` — Public profile page
- [ ] Message user from profile → `POST /conversations`

### Posts
- [ ] `GET /posts/{id}` — Post detail page
- [ ] `POST /posts/{id}/comments` — Comment UI on feed/detail
- [ ] Infinite pagination (`has_more`)

### Messaging
- [ ] `POST /conversations` — Start chat from Discover

### Notifications
- [ ] `PATCH /notifications/{id}/read` — Per-notification mark read

### Communities
- [ ] `POST /communities` — Create community
- [ ] `GET /communities/{id}` — Community detail
- [ ] `POST join` / `leave`
- [ ] `POST discussions` on detail page

### Teams
- [ ] `POST /teams` — Create team (workspace)
- [ ] `GET /teams/{id}` — Team detail
- [ ] `POST invite`, `POST channels`

### Startups
- [ ] `POST /startups` — Create startup
- [ ] `GET /startups/{id}` — Startup profile
- [ ] `PATCH /startups/{id}` — Edit (creator)
- [ ] `GET /positions` — Jobs tab

### News
- [ ] `GET /news/recommendations` — dedicated surfacing
- [ ] `GET /news/search` — Search page
- [ ] `GET /news/bookmarks` — Bookmarks page
- [ ] `GET /news/articles/{id}` — Article detail
- [ ] `POST/DELETE bookmark` — Bookmark actions in UI
- [ ] `GET /news/{category}` — Category routes

### GitHub
- [ ] `DELETE /github/disconnect`
- [ ] `GET /github/repos/{owner}/{repo}` — Repo detail
- [ ] `GET /github/trending` — Trending tab

### Dashboard
- [ ] `active_communities`, `startup_suggestions` widgets (API returns; UI partial)

---

## API Endpoint Matrix

| Endpoint | Service | UI (before) | UI (after) |
|----------|---------|-------------|------------|
| POST /auth/signup | ✅ | ✅ | ✅ |
| POST /auth/login | ✅ | ✅ | ✅ |
| POST /auth/logout | ✅ | ✅ | ✅ |
| POST /auth/google | ✅ | ✅ | ✅ |
| GET /users/me | ✅ | ✅ | ✅ |
| GET /users/search | ✅ | ❌ | ✅ `/discover` |
| GET /users/{id} | ✅ | ❌ | ✅ `/users/[id]` |
| PATCH /users/{id} | ✅ | ✅ | ✅ |
| GET /users/recommendations | ✅ | partial | ✅ |
| GET /posts | ✅ | ✅ | ✅ + pagination |
| POST /posts | ✅ | ✅ | ✅ |
| GET /posts/{id} | ✅ | ❌ | ✅ `/posts/[id]` |
| POST /posts/{id}/like | ✅ | ✅ | ✅ |
| POST /posts/{id}/comments | ✅ | ❌ | ✅ |
| GET /conversations | ✅ | ✅ | ✅ |
| POST /conversations | ⚠️ wrong body key | ❌ | ✅ |
| GET .../messages | ✅ | ✅ | ✅ |
| POST .../messages | ✅ | ✅ | ✅ |
| GET /notifications | ✅ | ✅ | ✅ |
| PATCH /notifications/{id}/read | ✅ | ❌ | ✅ |
| PATCH /notifications/read-all | ✅ | ✅ | ✅ |
| GET /communities | ✅ | ✅ | ✅ |
| POST /communities | ✅ | ❌ | ✅ `/communities/new` |
| GET /communities/{id} | ✅ | ❌ | ✅ `/communities/[id]` |
| GET/POST discussions | ✅ | partial | ✅ |
| POST join/leave | ✅ | ❌ | ✅ |
| GET /teams | ✅ | ✅ | ✅ |
| POST /teams | ✅ | ❌ | ✅ workspace |
| GET /teams/{id} | ✅ | ❌ | ✅ `/teams/[id]` |
| POST invite | ✅ | ❌ | ✅ |
| GET/POST channels | ✅ | partial | ✅ |
| GET /startups | ✅ | ✅ | ✅ |
| POST /startups | ✅ | ❌ | ✅ `/startups/new` |
| GET /startups/{id} | ✅ | ❌ | ✅ `/startups/[id]` |
| PATCH /startups/{id} | ✅ | ❌ | ✅ |
| GET /startups/{id}/positions | ✅ | ❌ | ✅ |
| GET /dashboard | ✅ | ✅ | ✅ enhanced |
| News (12 routes) | ✅ | ~67% | ✅ |
| GitHub (12 routes) | ✅ | ~75% | ✅ |

---

## Missing Components (addressed in upgrade)

- `AppShell` — shared sidebar layout
- `QueryProvider` — TanStack Query
- `AuthProvider` — session hydration
- `PostCard`, `CommentSection`, `UserCard`
- `EmptyState`, `LoadingSkeleton`
- Module hooks: `usePosts`, `useUsers`, `useCommunities`, etc.

---

## Missing Routes (added)

| Route | Purpose |
|-------|---------|
| `/discover` | User search + recommendations |
| `/users/[id]` | Public profile |
| `/posts/[id]` | Post + comments |
| `/communities/[id]` | Community hub |
| `/communities/new` | Create community |
| `/teams/[id]` | Team + channels + invite |
| `/startups/[id]` | Startup profile + jobs |
| `/startups/new` | Create startup |
| `/news/search` | News search |
| `/news/bookmarks` | Saved articles |
| `/news/articles/[id]` | Article reader |

---

## Missing State Management

- TanStack Query for server state (cache, refetch, mutations)
- Zustand retained for auth + UI chrome
- Query key factory in `lib/query-keys.ts`

---

## Missing UI Flows

- Discover → View profile → Message
- Feed → Post detail → Comment
- Community → Join → New discussion
- Workspace → Create team → Invite → Add channel
- Startups → Create → View positions
- News → Bookmark → Bookmarks page
- GitHub → Connect → Disconnect

---

## API Coverage %

**Service layer:** 64/64 endpoints (100%) after `participant_ids` fix + `communitiesAPI.create`

**UI integration (target):** 64/64 (100%)
