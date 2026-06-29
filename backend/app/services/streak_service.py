from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.streak import UserDailyLogin
from app.models.user import User


@dataclass
class StreakUpdateResult:
    current_streak: int
    longest_streak: int
    streak_started_at: datetime | None
    incremented_today: bool


def _utc_today(now: datetime | None = None) -> date:
    value = now or datetime.now(timezone.utc)
    return value.date()


async def apply_login_streak(db: AsyncSession, user: User, now: datetime | None = None) -> StreakUpdateResult:
    current_now = now or datetime.now(timezone.utc)
    today = _utc_today(current_now)
    last_active = user.last_active_date.date() if user.last_active_date else None

    incremented_today = False
    if last_active == today:
        user.last_active_at = current_now
    else:
        yesterday = today - timedelta(days=1)
        if last_active == yesterday and (user.login_streak_current or 0) > 0:
            user.login_streak_current = (user.login_streak_current or 0) + 1
        else:
            user.login_streak_current = 1
            user.streak_started_at = current_now

        user.login_streak_longest = max(user.login_streak_longest or 0, user.login_streak_current or 0)
        user.last_active_date = current_now
        user.last_active_at = current_now
        incremented_today = True

        existing = await db.execute(
            select(UserDailyLogin).where(
                UserDailyLogin.user_id == user.id,
                UserDailyLogin.activity_date == today,
            )
        )
        if not existing.scalar_one_or_none():
            db.add(UserDailyLogin(user_id=user.id, activity_date=today))

    return StreakUpdateResult(
        current_streak=user.login_streak_current or 0,
        longest_streak=user.login_streak_longest or 0,
        streak_started_at=user.streak_started_at,
        incremented_today=incremented_today,
    )


async def days_active_this_month(db: AsyncSession, user_id) -> int:
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).date()
    result = await db.execute(
        select(func.count())
        .select_from(UserDailyLogin)
        .where(
            UserDailyLogin.user_id == user_id,
            UserDailyLogin.activity_date >= month_start,
            UserDailyLogin.activity_date <= now.date(),
        )
    )
    return int(result.scalar() or 0)


def next_streak_milestone(current_streak: int) -> int:
    milestones = [3, 7, 14, 30, 60, 100, 180, 365]
    for value in milestones:
        if current_streak < value:
            return value
    return ((current_streak // 100) + 1) * 100
