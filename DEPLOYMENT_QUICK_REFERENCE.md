# 🚀 DEPLOYMENT QUICK REFERENCE - CRITICAL FIXES

## ⚠️ IMMEDIATE ACTIONS REQUIRED

### 1. Generate & Set Secret Key
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
# Copy the output and set:
export SECRET_KEY="<paste-generated-key>"
```

### 2. Set Production Database URL
```bash
export DATABASE_URL="postgresql+asyncpg://user:password@host:5432/nexus"
```

### 3. Disable Debug Mode
```bash
export DEBUG=False
```

### 4. Set Frontend & Callback URLs
```bash
export FRONTEND_URL="https://nexus.app"
export GITHUB_REDIRECT_URI="https://nexus.app/github/callback"
```

### 5. Set CORS Origins
```bash
export CORS_ORIGINS="https://nexus.app,https://www.nexus.app"
```

### 6. Set Frontend API URL
```bash
export NEXT_PUBLIC_API_URL="https://api.nexus.app/api"
```

---

## 📝 Environment Variables Checklist

### Backend (.env file)
```
DATABASE_URL=                    [CRITICAL] Production PostgreSQL connection
SECRET_KEY=                      [CRITICAL] Generated with secrets module
DEBUG=False                      [CRITICAL] Must be False in production
CORS_ORIGINS=                    [CRITICAL] Your production frontend URL(s)
FRONTEND_URL=                    [CRITICAL] Production frontend domain
GITHUB_REDIRECT_URI=             [CRITICAL] Must match GitHub OAuth app
GITHUB_CLIENT_ID=                [HIGH] Get from GitHub app settings
GITHUB_CLIENT_SECRET=            [HIGH] Get from GitHub app settings
GOOGLE_CLIENT_ID=                [OPTIONAL]
GOOGLE_CLIENT_SECRET=            [OPTIONAL]
RESEND_API_KEY=                  [OPTIONAL]
FROM_EMAIL=                      [OPTIONAL]
```

### Frontend (.env.local file)
```
NEXT_PUBLIC_API_URL=             [CRITICAL] Backend API endpoint
NEXT_PUBLIC_GOOGLE_CLIENT_ID=    [OPTIONAL]
```

---

## 🔐 Security Issues (Must Fix Before Production)

| Issue | File | Line | Status |
|-------|------|------|--------|
| SECRET_KEY="change-me-in-production" | backend/app/config/settings.py | 24 | ⚠️ CRITICAL |
| DATABASE_URL=localhost:5432 | backend/app/config/settings.py | 21 | ⚠️ CRITICAL |
| DEBUG=True | backend/app/config/settings.py | 16 | ⚠️ CRITICAL |
| GITHUB_REDIRECT_URI=localhost | backend/app/config/settings.py | 38 | ⚠️ CRITICAL |
| Dev CORS origins always active | backend/app/main.py | 36-37 | ⚠️ HIGH |
| Frontend API URL=localhost | FRONTEND/lib/config/api.ts | 1 | ⚠️ HIGH |

---

## ✅ Pre-Deployment Verification

```bash
# 1. Frontend builds without errors
cd FRONTEND && npm run build

# 2. Backend imports and settings load
cd backend && python -c "from app.config.settings import get_settings; print(get_settings())"

# 3. Database migrations ready
cd backend && alembic current

# 4. All required env vars set (add to your deployment script):
test -n "$DATABASE_URL" || echo "ERROR: DATABASE_URL not set"
test -n "$SECRET_KEY" || echo "ERROR: SECRET_KEY not set"
test -n "$GITHUB_CLIENT_ID" || echo "ERROR: GITHUB_CLIENT_ID not set"
test -n "$GITHUB_CLIENT_SECRET" || echo "ERROR: GITHUB_CLIENT_SECRET not set"
```

---

## 🌐 Third-Party Setup Required

### GitHub OAuth App
1. Go to https://github.com/settings/developers
2. Create a new OAuth App (or edit existing)
3. Set Authorization callback URL to: `https://your-domain.com/github/callback`
4. Note down: Client ID and Client Secret

### Domain & SSL
- [ ] Register domain (e.g., nexus.app)
- [ ] Set up SSL certificate (Let's Encrypt / AWS Certificate Manager)
- [ ] Configure DNS records to point to deployment platform

### Database
- [ ] Create PostgreSQL instance on Render/AWS/Supabase
- [ ] Note down connection string: `postgresql+asyncpg://user:pass@host:5432/db`
- [ ] Test connection from backend before deploying

---

## 📋 Deployment Timeline

**Day -1 (Preparation)**
- Generate SECRET_KEY
- Set up GitHub OAuth app
- Create production database
- Prepare environment variables

**Day 0 (Deployment)**
- Deploy backend with all env vars set
- Deploy frontend with NEXT_PUBLIC_API_URL
- Run migrations
- Verify health endpoints

**Day 0 (Validation)**
- Test frontend loads
- Test API responds
- Test WebSocket connects
- Test OAuth flow
- Test file upload

---

## 🔗 Helpful Links

- Full Audit: [DEPLOYMENT_READINESS_AUDIT.md](DEPLOYMENT_READINESS_AUDIT.md)
- Backend Settings: [backend/app/config/settings.py](../backend/app/config/settings.py)
- Frontend Config: [FRONTEND/lib/config/api.ts](../FRONTEND/lib/config/api.ts)
- Backend Example: [backend/.env.example](../backend/.env.example)
- Frontend Example: [FRONTEND/.env.local.example](../FRONTEND/.env.local.example)

---

**Status:** 🟡 Deployment ready after critical fixes
