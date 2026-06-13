"""TEMP DATABASE DIAGNOSTIC — delete this module when investigation is complete."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.diagnostics.database_temp import resolve_database_source
from app.models.user import User

# TEMP DATABASE DIAGNOSTIC
router = APIRouter(tags=["TEMP DATABASE DIAGNOSTIC"])


@router.get("/debug/database")
async def debug_database():
    # TEMP DATABASE DIAGNOSTIC
    return resolve_database_source()


@router.get("/debug/users-count")
async def debug_users_count(db: AsyncSession = Depends(get_db)):
    # TEMP DATABASE DIAGNOSTIC
    user_count = await db.scalar(select(func.count()).select_from(User)) or 0
    return {"user_count": user_count}
