# Nexus Backend API

Production-ready FastAPI backend for the **Nexus** futuristic startup networking platform. Built to match the existing Next.js frontend (`FRONTEND/services/api.ts`, `news-api.ts`, `github-api.ts`).

## Stack

- FastAPI + Uvicorn
- PostgreSQL + SQLAlchemy 2 (async)
- JWT auth (bcrypt passwords)
- WebSockets (real-time messaging)
- Alembic migrations
- GNews + Dev.to + GitHub API integrations

## Quick start

### 1. Prerequisites

- Python 3.11+
- PostgreSQL 14+

### 2. Setup

```bash
cd backend
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

### 3. Configure environment

Copy `.env.example` to `.env` and set:

- `DATABASE_URL` — PostgreSQL connection string
- `SECRET_KEY` — long random string for JWT signing
- Optional: `GNEWS_API_KEY`, `GITHUB_CLIENT_*`, `RESEND_API_KEY`

Create the database:

```sql
CREATE DATABASE nexus;
```

### 4. Run the server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API base: `http://localhost:8000/api`
- Swagger docs: `http://localhost:8000/docs`
- Health: `http://localhost:8000/health`

### 5. Connect the frontend

In `FRONTEND/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

## Authentication flow

1. **Signup** — `POST /api/auth/signup` with `{ name, email, password, role?, skills? }`
2. **Login** — `POST /api/auth/login` with `{ email, password }`
3. Response includes `access_token`, `refresh_token`, and `user` (matches Zustand store shape)
4. Frontend stores token in `auth-storage` (Zustand persist); Axios interceptor sends `Authorization: Bearer <token>`
5. **Protected routes** — require valid JWT via `get_current_user` dependency
6. **Logout** — `POST /api/auth/logout` (client clears token; stateless JWT)

## WebSocket messaging

Connect with JWT:

```
ws://localhost:8000/api/ws?token=<access_token>&conversation_id=<uuid>
```

Events:

- `connected` — handshake success
- `message` — new message broadcast to conversation subscribers

REST fallback: `GET/POST /api/conversations/...`

## API map (frontend-aligned)

| Area | Endpoints |
|------|-----------|
| Auth | `/api/auth/signup`, `/login`, `/logout`, `/google` |
| Users | `/api/users/me`, `/recommendations`, `/search`, `/{id}` |
| Posts | `/api/posts`, `/{id}/like`, `/{id}/comments` |
| Messages | `/api/conversations`, `.../messages` |
| Notifications | `/api/notifications`, `.../read` |
| Communities | `/api/communities`, `.../discussions`, `/join` |
| Teams | `/api/teams`, `.../channels`, `/invite` |
| Startups | `/api/startups`, `.../positions` |
| Dashboard | `/api/dashboard` |
| News | `/api/news/trending`, `/ai`, `/startups`, `/devto`, ... |
| GitHub | `/api/github/profile`, `/repos`, `/oauth/init`, ... |

## Project structure

```
backend/
├── app/
│   ├── main.py           # FastAPI app + CORS
│   ├── database.py       # Async engine + sessions
│   ├── config/           # Pydantic settings
│   ├── core/             # JWT + password hashing
│   ├── models/           # SQLAlchemy ORM
│   ├── schemas/          # Pydantic request/response
│   ├── routes/           # REST routers
│   ├── services/         # News, GitHub, email
│   ├── websocket/        # Real-time manager
│   └── dependencies/     # Auth injection
├── alembic/              # Migrations
├── requirements.txt
└── .env
```

## Migrations

Tables are auto-created on startup (`init_db`) for local development. For production:

```bash
alembic revision --autogenerate -m "describe change"
alembic upgrade head
```

## Future expansion (architecture-ready)

- Redis caching for news/GitHub responses
- Celery for background jobs
- Refresh token blacklist in Redis
- Vector search for AI recommendations
- Google OAuth token verification

## License

Proprietary — Nexus platform.
