from fastapi import APIRouter
from app.routes import (
    admin,
    auth,
    bookmarks,
    comments,
    communities,
    connections,
    conversations,
    dashboard,
    github,
    news,
    notifications,
    posts,
    reactions,
    referrals,
    reports,
    search,
    startups,
    teams,
    topics,
    upload,
    users,
    verification,
    workspaces,
 
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(admin.router)
api_router.include_router(connections.router)
api_router.include_router(workspaces.router)
api_router.include_router(users.router)
api_router.include_router(posts.router)
api_router.include_router(comments.router)
api_router.include_router(reactions.router)
api_router.include_router(bookmarks.router)
api_router.include_router(conversations.router)
api_router.include_router(notifications.router)
api_router.include_router(communities.router)
api_router.include_router(teams.router)
api_router.include_router(startups.router)
api_router.include_router(dashboard.router)
api_router.include_router(news.router)
api_router.include_router(search.router)
api_router.include_router(topics.router)
api_router.include_router(upload.router)
api_router.include_router(verification.router)
api_router.include_router(referrals.router)
api_router.include_router(reports.router)
api_router.include_router(github.router)
