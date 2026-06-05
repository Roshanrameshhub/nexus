import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, List, Optional
from urllib.parse import urlencode

import httpx

from app.config.settings import get_settings

settings = get_settings()
GITHUB_API = "https://api.github.com"


class GitHubService:
    def oauth_init_url(self) -> str:
        params = {
            "client_id": settings.GITHUB_CLIENT_ID,
            "redirect_uri": settings.GITHUB_REDIRECT_URI,
            "scope": "read:user repo",
        }
        return f"https://github.com/login/oauth/authorize?{urlencode(params)}"

    async def exchange_code(self, code: str) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://github.com/login/oauth/access_token",
                headers={"Accept": "application/json"},
                data={
                    "client_id": settings.GITHUB_CLIENT_ID,
                    "client_secret": settings.GITHUB_CLIENT_SECRET,
                    "code": code,
                    "redirect_uri": settings.GITHUB_REDIRECT_URI,
                },
            )
            resp.raise_for_status()
            return resp.json()

    async def _get(self, path: str, token: Optional[str] = None) -> Any:
        headers = {"Accept": "application/vnd.github+json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"{GITHUB_API}{path}", headers=headers)
            if resp.status_code != 200:
                return None
            return resp.json()

    def map_user(self, data: dict) -> dict[str, Any]:
        return {
            "id": str(data.get("id", "")),
            "login": data.get("login", ""),
            "name": data.get("name") or data.get("login", ""),
            "avatarUrl": data.get("avatar_url", ""),
            "bio": data.get("bio") or "",
            "company": data.get("company"),
            "location": data.get("location"),
            "blog": data.get("blog"),
            "twitterUsername": data.get("twitter_username"),
            "publicRepos": data.get("public_repos", 0),
            "publicGists": data.get("public_gists", 0),
            "followers": data.get("followers", 0),
            "following": data.get("following", 0),
            "createdAt": data.get("created_at", datetime.now(timezone.utc).isoformat()),
            "updatedAt": data.get("updated_at", datetime.now(timezone.utc).isoformat()),
            "hireable": data.get("hireable"),
        }

    def map_repo(self, data: dict) -> dict[str, Any]:
        license_data = data.get("license") or {}
        return {
            "id": str(data.get("id", "")),
            "name": data.get("name", ""),
            "fullName": data.get("full_name", ""),
            "description": data.get("description") or "",
            "owner": {
                "login": data.get("owner", {}).get("login", ""),
                "avatarUrl": data.get("owner", {}).get("avatar_url", ""),
            },
            "htmlUrl": data.get("html_url", ""),
            "language": data.get("language") or "Other",
            "stargazersCount": data.get("stargazers_count", 0),
            "forksCount": data.get("forks_count", 0),
            "watchersCount": data.get("watchers_count", 0),
            "openIssuesCount": data.get("open_issues_count", 0),
            "topics": data.get("topics", []),
            "visibility": data.get("visibility", "public"),
            "defaultBranch": data.get("default_branch", "main"),
            "createdAt": data.get("created_at", ""),
            "updatedAt": data.get("updated_at", ""),
            "pushedAt": data.get("pushed_at", ""),
            "license": {"key": license_data.get("key", ""), "name": license_data.get("name", "")}
            if license_data
            else None,
            "isArchived": data.get("archived", False),
            "isFork": data.get("fork", False),
        }

    async def get_profile(self, username: str, token: Optional[str] = None) -> Optional[dict]:
        data = await self._get(f"/users/{username}", token)
        return self.map_user(data) if data else None

    async def get_repos(
        self, username: str, token: Optional[str] = None, page: int = 1, limit: int = 20, sort: str = "updated"
    ) -> List[dict]:
        sort_param = "pushed" if sort == "updated" else sort
        data = await self._get(
            f"/users/{username}/repos?per_page={limit}&page={page}&sort={sort_param}",
            token,
        )
        if not data:
            return []
        return [self.map_repo(r) for r in data]

    async def get_activity(self, username: str, token: Optional[str] = None, page: int = 1, limit: int = 20) -> List[dict]:
        data = await self._get(f"/users/{username}/events/public?per_page={limit}&page={page}", token)
        if not data:
            return []

        activities: List[dict[str, Any]] = []
        for event in data:
            event_type = event.get("type", "")
            repo_name = event.get("repo", {}).get("name", "")
            created_at = event.get("created_at", datetime.now(timezone.utc).isoformat())
            payload = event.get("payload", {}) or {}
            description = ""
            activity_type = "review"

            if event_type == "PushEvent":
                commit_count = len(payload.get("commits", []))
                description = f"Pushed {commit_count} commit{'s' if commit_count != 1 else ''} to {repo_name}"
                activity_type = "push"
            elif event_type == "PullRequestEvent":
                action = payload.get("action", "updated")
                description = f"{action.title()} pull request in {repo_name}"
                activity_type = "pr"
            elif event_type == "IssuesEvent":
                action = payload.get("action", "updated")
                description = f"{action.title()} issue in {repo_name}"
                activity_type = "issue"
            elif event_type == "WatchEvent":
                description = f"Starred {repo_name}"
                activity_type = "star"
            elif event_type == "ForkEvent":
                description = f"Forked {repo_name}"
                activity_type = "fork"
            elif event_type == "CreateEvent":
                ref_type = payload.get("ref_type", "resource")
                description = f"Created {ref_type} in {repo_name}"
                activity_type = "create"
            elif event_type == "PullRequestReviewEvent":
                description = f"Reviewed a pull request in {repo_name}"
                activity_type = "review"
            else:
                description = payload.get("action", event_type)
                activity_type = "review"

            activities.append(
                {
                    "id": str(event.get("id", f"{repo_name}-{created_at}")),
                    "type": activity_type,
                    "repo": repo_name,
                    "repoUrl": f"https://github.com/{repo_name}" if repo_name else "https://github.com",
                    "description": description,
                    "createdAt": created_at,
                }
            )
        return activities

    async def get_contributions(self, username: str, token: Optional[str] = None, pages: int = 3) -> dict[str, Any]:
        events: list[dict[str, Any]] = []
        for page in range(1, pages + 1):
            page_data = await self._get(f"/users/{username}/events/public?per_page=100&page={page}", token)
            if not page_data:
                break
            events.extend(page_data)

        date_counts: dict[str, int] = {}
        for event in events:
            created_at = event.get("created_at")
            if not created_at:
                continue
            date = datetime.fromisoformat(created_at.replace("Z", "+00:00")).date().isoformat()
            date_counts[date] = date_counts.get(date, 0) + 1

        today = datetime.now(timezone.utc).date()
        start_date = today - timedelta(days=today.weekday()) - timedelta(weeks=51)
        total_contributions = sum(date_counts.values())

        current_streak = 0
        current_date = today
        while date_counts.get(current_date.isoformat(), 0) > 0:
            current_streak += 1
            current_date -= timedelta(days=1)

        longest_streak = 0
        streak = 0
        scan_date = start_date
        while scan_date <= today:
            if date_counts.get(scan_date.isoformat(), 0) > 0:
                streak += 1
                longest_streak = max(longest_streak, streak)
            else:
                streak = 0
            scan_date += timedelta(days=1)

        weeks: list[list[dict[str, Any]]] = []
        for week_index in range(52):
            week = []
            for day_index in range(7):
                day = start_date + timedelta(days=week_index * 7 + day_index)
                count = date_counts.get(day.isoformat(), 0)
                level = min(4, (count + 1) // 2) if count > 0 else 0
                week.append({"date": day.isoformat(), "count": count, "level": level})
            weeks.append(week)

        return {
            "totalContributions": total_contributions,
            "currentStreak": current_streak,
            "longestStreak": longest_streak,
            "weeks": weeks,
        }

    async def get_language_stats(self, username: str, token: Optional[str] = None, repo_limit: int = 20) -> List[dict[str, Any]]:
        repos = await self._get(f"/users/{username}/repos?per_page={repo_limit}&page=1&sort=pushed", token)
        if not repos:
            return []

        async with httpx.AsyncClient(timeout=15.0) as client:
            tasks = []
            for repo in repos:
                full_name = repo.get("full_name")
                if full_name:
                    tasks.append(client.get(f"{GITHUB_API}/repos/{full_name}/languages", headers={"Accept": "application/vnd.github+json", **({"Authorization": f"Bearer {token}"} if token else {})}))
            responses = await asyncio.gather(*tasks, return_exceptions=True)

        language_totals: dict[str, int] = {}
        for response in responses:
            if isinstance(response, Exception) or response.status_code != 200:
                continue
            for lang, bytes_count in response.json().items():
                language_totals[lang] = language_totals.get(lang, 0) + bytes_count

        total_bytes = sum(language_totals.values())
        if total_bytes == 0:
            return []

        return [
            {
                "language": language,
                "percentage": round((bytes_count / total_bytes) * 100),
                "color": LANGUAGE_COLORS.get(language, "#6e6e6e"),
                "bytes": bytes_count,
            }
            for language, bytes_count in sorted(language_totals.items(), key=lambda item: item[1], reverse=True)
        ]

    async def get_suggested_contributors(self, count: int = 5) -> List[dict[str, Any]]:
        search = await self._get(f"/search/users?q=followers:%3E10000&sort=followers&order=desc&per_page={count}")
        if not search:
            return []

        logins = [item.get("login") for item in search.get("items", []) if item.get("login")]
        profiles = await asyncio.gather(*(self.get_profile(login) for login in logins))
        return [profile for profile in profiles if profile]


github_service = GitHubService()
