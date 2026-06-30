from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import Optional
from datetime import datetime, timedelta
import uuid
import secrets
import string

from app.config.settings import get_settings
from app.database import get_db
from app.models.user import User
from app.models.referral import Referral, ReferralStatus
from app.dependencies.auth import get_current_user

settings = get_settings()

router = APIRouter(prefix="/referrals", tags=["referrals"])

# ─── GENERATE UNIQUE CODE ─────────────────────────────────────
def generate_referral_code() -> str:
    """Generate unique referral code for each user"""
    chars = string.ascii_uppercase + string.digits
    return "REF" + ''.join(secrets.choice(chars) for _ in range(8))


# ─── GET MY REFERRAL CODE (For Normal Users) ────────────────
@router.get("/my-code")
async def get_my_referral_code(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get or create referral code for current user (Only for normal users)"""
    
    # Admin should not get referral code
    if current_user.platform_role == "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Admins cannot have referral codes")
    
    if not current_user.referral_code:
        code = generate_referral_code()
        while True:
            existing = await db.execute(
                select(User).where(User.referral_code == code)
            )
            if not existing.scalar_one_or_none():
                break
            code = generate_referral_code()
        
        current_user.referral_code = code
        await db.commit()
    
    return {
        "referral_code": current_user.referral_code,
        "referral_link": f"{settings.FRONTEND_URL.rstrip('/')}/signup?ref={current_user.referral_code}",
        "referral_count": current_user.referral_count or 0
    }


# ─── APPLY REFERRAL CODE (When user signs up) ───────────────
@router.post("/apply")
async def apply_referral_code(
    code: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Apply a referral code when a user signs up"""
    
    # Admin cannot apply referral codes
    if current_user.platform_role == "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Admins cannot use referral codes")
    
    # Find the referrer (user who owns this code)
    result = await db.execute(
        select(User).where(User.referral_code == code)
    )
    referrer = result.scalar_one_or_none()
    
    if not referrer:
        raise HTTPException(status_code=404, detail="Invalid referral code")
    
    if referrer.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot refer yourself")
    
    # Check if user already used a referral
    existing = await db.execute(
        select(Referral).where(Referral.referred_user_id == current_user.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Referral already applied")
    
    # Create referral record
    referral = Referral(
        id=uuid.uuid4(),
        referrer_id=referrer.id,
        referred_user_id=current_user.id,
        referral_code=code,
        status=ReferralStatus.pending,
        source="direct",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        referred_at=datetime.utcnow()
    )
    
    db.add(referral)
    await db.commit()
    await db.refresh(referral)
    
    # Update referrer's count
    referrer.referral_count = (referrer.referral_count or 0) + 1
    await db.commit()
    
    return {
        "message": "Referral applied successfully!",
        "referrer": referrer.name,
        "referral_id": str(referral.id)
    }


# ─── MY REFERRAL STATS (For Normal Users) ───────────────────
@router.get("/my-stats")
async def get_my_referral_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get referral statistics for current user"""
    
    # Admin shouldn't have referral stats
    if current_user.platform_role == "SUPER_ADMIN":
        return {
            "total": 0,
            "completed": 0,
            "pending": 0,
            "growth_rate": 0,
            "referral_code": None,
            "message": "Admins don't have referral stats"
        }
    
    # Total referrals
    total_result = await db.execute(
        select(func.count(Referral.id)).where(Referral.referrer_id == current_user.id)
    )
    total = total_result.scalar() or 0
    
    # Completed referrals
    completed_result = await db.execute(
        select(func.count(Referral.id)).where(
            and_(Referral.referrer_id == current_user.id, Referral.status == ReferralStatus.completed)
        )
    )
    completed = completed_result.scalar() or 0
    
    # Pending referrals
    pending_result = await db.execute(
        select(func.count(Referral.id)).where(
            and_(Referral.referrer_id == current_user.id, Referral.status == ReferralStatus.pending)
        )
    )
    pending = pending_result.scalar() or 0
    
    # Growth rate (last 30 days vs previous 30 days)
    now = datetime.utcnow()
    last_30 = now - timedelta(days=30)
    prev_30 = last_30 - timedelta(days=30)
    
    current_result = await db.execute(
        select(func.count(Referral.id)).where(
            and_(Referral.referrer_id == current_user.id, Referral.referred_at >= last_30)
        )
    )
    current = current_result.scalar() or 0
    
    previous_result = await db.execute(
        select(func.count(Referral.id)).where(
            and_(Referral.referrer_id == current_user.id, 
                 Referral.referred_at >= prev_30, 
                 Referral.referred_at < last_30)
        )
    )
    previous = previous_result.scalar() or 0
    
    growth_rate = 0
    if previous > 0:
        growth_rate = round(((current - previous) / previous) * 100, 2)
    elif current > 0:
        growth_rate = 100
    
    return {
        "total": total,
        "completed": completed,
        "pending": pending,
        "growth_rate": growth_rate,
        "current_period": current,
        "previous_period": previous,
        "referral_code": current_user.referral_code
    }


# ─── MY REFERRALS LIST (Who I referred) ─────────────────────
@router.get("/my-referrals")
async def get_my_referrals(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get list of people referred by current user"""
    
    # Admin shouldn't have referrals
    if current_user.platform_role == "SUPER_ADMIN":
        return {"referrals": [], "message": "Admins don't have referrals"}
    
    result = await db.execute(
        select(Referral, User)
        .join(User, Referral.referred_user_id == User.id)
        .where(Referral.referrer_id == current_user.id)
        .order_by(Referral.referred_at.desc())
    )
    
    referrals = []
    for referral, user in result.all():
        referrals.append({
            "referral_id": str(referral.id),
            "referred_user": {
                "id": str(user.id),
                "name": user.name,
                "email": user.email,
                "joined_at": user.created_at.isoformat() if user.created_at else None
            },
            "status": referral.status.value,
            "referred_at": referral.referred_at.isoformat(),
            "completed_at": referral.completed_at.isoformat() if referral.completed_at else None,
            "source": referral.source
        })
    
    return {"referrals": referrals}


# ─── ADMIN: ALL REFERRALS (Who referred whom) ──────────────
@router.get("/admin/all-referrals")
async def get_all_referrals(
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """ADMIN ONLY: Get all referrals - shows who referred whom"""
    
    # Only admin can access this
    if current_user.platform_role != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get all referrals with referrer and referred user
    result = await db.execute(
        select(Referral, User, User)
        .join(User, Referral.referrer_id == User.id)
        .join(User, Referral.referred_user_id == User.id)
        .order_by(Referral.referred_at.desc())
        .limit(limit)
        .offset(offset)
    )
    
    referrals = []
    for referral, referrer, referred_user in result.all():
        referrals.append({
            "id": str(referral.id),
            "referrer": {
                "id": str(referrer.id),
                "name": referrer.name,
                "email": referrer.email
            },
            "referred_user": {
                "id": str(referred_user.id),
                "name": referred_user.name,
                "email": referred_user.email,
                "joined_at": referred_user.created_at.isoformat() if referred_user.created_at else None
            },
            "referral_code": referral.referral_code,
            "status": referral.status.value,
            "source": referral.source,
            "referred_at": referral.referred_at.isoformat(),
            "completed_at": referral.completed_at.isoformat() if referral.completed_at else None
        })
    
    # Get total count
    total_result = await db.execute(select(func.count(Referral.id)))
    total = total_result.scalar() or 0
    
    return {
        "referrals": referrals,
        "total": total,
        "limit": limit,
        "offset": offset
    }


# ─── ADMIN: REFERRAL ANALYTICS ──────────────────────────────
@router.get("/admin/analytics")
async def get_referral_analytics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """ADMIN ONLY: Get overall referral analytics"""
    
    if current_user.platform_role != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Total referrals
    total_result = await db.execute(select(func.count(Referral.id)))
    total = total_result.scalar() or 0
    
    # Completed referrals
    completed_result = await db.execute(
        select(func.count(Referral.id)).where(Referral.status == ReferralStatus.completed)
    )
    completed = completed_result.scalar() or 0
    
    # Pending referrals
    pending_result = await db.execute(
        select(func.count(Referral.id)).where(Referral.status == ReferralStatus.pending)
    )
    pending = pending_result.scalar() or 0
    
    # Users with referrals
    users_with_refs_result = await db.execute(
        select(func.count(User.id)).where(User.referral_count > 0)
    )
    users_with_refs = users_with_refs_result.scalar() or 0
    
    # Top referrers (users who referred the most)
    top_result = await db.execute(
        select(User.id, User.name, User.email, User.referral_count)
        .where(User.referral_count > 0)
        .order_by(User.referral_count.desc())
        .limit(10)
    )
    top_referrers = top_result.all()
    
    # Recent referrals with names (who referred whom)
    recent_result = await db.execute(
        select(Referral, User, User)
        .join(User, Referral.referrer_id == User.id)
        .join(User, Referral.referred_user_id == User.id)
        .order_by(Referral.referred_at.desc())
        .limit(20)
    )
    
    recent = []
    for referral, referrer, referred_user in recent_result.all():
        recent.append({
            "referrer_name": referrer.name,
            "referred_name": referred_user.name,
            "referred_at": referral.referred_at.isoformat(),
            "status": referral.status.value
        })
    
    return {
        "total": total,
        "completed": completed,
        "pending": pending,
        "users_with_referrals": users_with_refs,
        "conversion_rate": round((completed / total * 100) if total > 0 else 0, 2),
        "top_referrers": [
            {
                "user_id": str(r[0]),
                "name": r[1],
                "email": r[2],
                "count": r[3]
            }
            for r in top_referrers
        ],
        "recent_activity": recent
    }


# ─── CHECK IF USER HAS REFERRAL CODE ────────────────────────
@router.get("/has-code")
async def check_referral_code(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Check if current user has a referral code"""
    
    if current_user.platform_role == "SUPER_ADMIN":
        return {"has_code": False, "message": "Admins don't have referral codes"}
    
    return {
        "has_code": current_user.referral_code is not None,
        "referral_code": current_user.referral_code
    }
