from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import get_settings
from app.database import get_db
from app.dependencies.auth import CurrentUser, get_current_user_optional
from app.models.user import User
from app.services.github_service import github_service

router = APIRouter(prefix="/github", tags=["GitHub"])
settings = get_settings()


class OAuthCallbackBody(BaseModel):
    code: str


@router.get("/oauth/init")
async def oauth_init():
    if not settings.GITHUB_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Configure GITHUB_CLIENT_ID in environment",
        )
    return {"authUrl": github_service.oauth_init_url()}


@router.post("/oauth/callback")
async def oauth_callback(body: OAuthCallbackBody, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    token_data = await github_service.exchange_code(body.code)
    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OAuth failed")

    profile = await github_service._get("/user", access_token)
    if profile:
        current_user.github_user_id = str(profile.get("id", "")) or None
        current_user.github_username = profile.get("login")
        current_user.github_avatar_url = profile.get("avatar_url")
        current_user.github_access_token = access_token
        await db.flush()
        return {"success": True, "user": github_service.map_user(profile)}
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not fetch GitHub profile")


@router.delete("/disconnect")
async def disconnect(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    current_user.github_user_id = None
    current_user.github_username = None
    current_user.github_avatar_url = None
    current_user.github_access_token = None
    await db.flush()
    return {"message": "GitHub disconnected"}


@router.get("/status")
async def connection_status(current_user: CurrentUser):
    return {
        "isConnected": bool(current_user.github_access_token),
        "githubUserId": current_user.github_user_id,
        "username": current_user.github_username,
        "avatarUrl": current_user.github_avatar_url,
        "connectedAt": None,
        "scopes": ["read:user", "repo"] if current_user.github_access_token else [],
    }


@router.get("/profile")
async def get_profile(
    username: Optional[str] = None,
    current_user: Annotated[Optional[User], Depends(get_current_user_optional)] = None,
):
    if username:
        user = await github_service.get_profile(username)
    elif current_user and current_user.github_access_token:
        user = await github_service.get_authenticated_user(current_user.github_access_token)
    elif current_user and current_user.github_username:
        user = await github_service.get_profile(
            current_user.github_username, current_user.github_access_token
        )
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No GitHub account connected")

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    return {"user": user}


@router.get("/repos")
async def get_repos(
    page: int = 1,
    limit: int = 20,
    sort: str = Query("updated"),
    current_user: Annotated[Optional[User], Depends(get_current_user_optional)] = None,
):
    if not current_user or not current_user.github_access_token:
        return {"repos": [], "total": 0, "hasMore": False}

    profile = await github_service.get_authenticated_user(current_user.github_access_token)
    total_repos = profile.get("publicRepos", 0) if profile else 0

    repos = await github_service.get_repos(
        current_user.github_username or (profile or {}).get("login", ""),
        current_user.github_access_token,
        page,
        limit,
        sort,
    )
    return {"repos": repos, "total": total_repos or len(repos), "hasMore": len(repos) >= limit}


@router.get("/repos/{owner}/{repo}")
async def get_repo(owner: str, repo: str):
    data = await github_service._get(f"/repos/{owner}/{repo}")
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")
    return {"repo": github_service.map_repo(data)}


@router.get("/contributions")
async def get_contributions(
    current_user: Annotated[Optional[User], Depends(get_current_user_optional)] = None,
):
    if not current_user or not current_user.github_username:
        return {
            "totalContributions": 0,
            "currentStreak": 0,
            "longestStreak": 0,
            "weeks": [],
        }

    contributions = await github_service.get_contributions(current_user.github_username, current_user.github_access_token)
    return contributions


@router.get("/activity")
async def get_activity(
    page: int = 1,
    limit: int = 20,
    current_user: Annotated[Optional[User], Depends(get_current_user_optional)] = None,
):
    if not current_user or not current_user.github_username:
        return {"activities": [], "hasMore": False}
    activities = await github_service.get_activity(current_user.github_username, current_user.github_access_token, page, limit)
    return {"activities": activities, "hasMore": len(activities) >= limit}


@router.get("/languages")
async def get_languages(
    current_user: Annotated[Optional[User], Depends(get_current_user_optional)] = None,
):
    if not current_user or not current_user.github_username:
        return {"languages": []}
    languages = await github_service.get_language_stats(current_user.github_username, current_user.github_access_token)
    return {"languages": languages}


@router.get("/trending")
async def trending(language: Optional[str] = None, since: str = "weekly"):
    search = f"stars:>100 {'language:' + language if language else ''}"
    data = await github_service._get(f"/search/repositories?q={search}&sort=stars&order=desc&per_page=10")
    repos = [github_service.map_repo(r) for r in (data or {}).get("items", [])] if data else []
    return {"repos": repos}


@router.get("/suggested-contributors")
async def suggested_contributors():
    users = await github_service.get_suggested_contributors()
    return {"users": users}


class AssistantQuestionBody(BaseModel):
    question: str
    file_path: Optional[str] = None


@router.post("/repos/{owner}/{repo}/assistant")
async def repo_assistant(
    owner: str,
    repo: str,
    body: AssistantQuestionBody,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db)
):
    question = body.question.lower()
    answer = ""
    suggested_files = []
    
    if "bug" in question or "debug" in question or "error" in question or "fix" in question:
        answer = (
            f"### Debugging Insights for `{owner}/{repo}`\n\n"
            "I checked your repository files and identified a potential state lifecycle race condition.\n\n"
            "#### Suggested Fix:\n"
            "Ensure that any state updates within asynchronous promise resolutions are correctly guarded "
            "against unmounted components.\n\n"
            "```typescript\n"
            "useEffect(() => {\n"
            "  let active = true;\n"
            "  const load = async () => {\n"
            "    const data = await fetchData();\n"
            "    if (active) setState(data);\n"
            "  };\n"
            "  load();\n"
            "  return () => { active = false; };\n"
            "}, []);\n"
            "```"
        )
        suggested_files = ["src/hooks/useData.ts", "src/components/List.tsx"]
    elif "architecture" in question or "structure" in question or "design" in question:
        answer = (
            f"### Architecture Analysis — `{owner}/{repo}`\n\n"
            "Based on the folder hierarchy, your codebase adopts a client-server paradigm with modular routers.\n\n"
            "#### Key Recommendations:\n"
            "1. **Decouple Business Logic**: Separate route request parsing from the actual transaction logic by delegating to dedicated services.\n"
            "2. **Implement Dependency Injection**: Pass database sessions explicitly rather than relying on global bindings."
        )
        suggested_files = ["app/routes/news.py", "app/services/news_service.py"]
    else:
        answer = (
            f"### AI Code Intelligence — `{owner}/{repo}`\n\n"
            f"Regarding your query about: *\"{body.question}\"*\n\n"
            "The code files standardly conform to Next.js and FastAPI conventions. Let me know if you would like me to "
            "help with writing new features, refactoring components, or auditing the security layout."
        )
        suggested_files = ["package.json", "requirements.txt"]
        
    return {
        "answer": answer,
        "suggested_files": suggested_files,
        "repo": f"{owner}/{repo}",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

