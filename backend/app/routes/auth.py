import logging
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from google.oauth2 import id_token
from google.auth.transport import requests

from app.config.settings import get_settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    verify_password,
)
from app.database import get_db
from app.dependencies.auth import CurrentUser
from app.models.user import User, UserRole
from app.schemas.auth import (
    ForgotPasswordRequest,
    GoogleAuthRequest,
    LoginRequest,
    MessageResponse,
    RefreshTokenRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    SignupRequest,
    SignupResponse,
    TokenResponse,
)
from app.services.email_service import (
    send_password_reset_email,
    send_verification_email,
    send_welcome_email,
)
from app.services.referral_service import apply_referral_on_signup, ensure_referral_code
from app.services.streak_service import apply_login_streak
from app.utils.helpers import generate_username
from app.utils.user_mapper import to_user_response

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])

settings = get_settings()

EMAIL_NOT_VERIFIED_MESSAGE = "Please verify your email before logging in."


def _verification_url(token: str) -> str:
    base = (settings.FRONTEND_URL or "https://www.rconnectx.com").rstrip("/")
    return f"{base}/verify-email?token={token}"


def _issue_email_verification_token(user: User) -> str:
    token = secrets.token_urlsafe(32)
    user.email_verification_token = token
    user.email_verification_expires = datetime.now(timezone.utc) + timedelta(hours=24)
    return token


def _require_email_verified(user: User) -> None:
    if not user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=EMAIL_NOT_VERIFIED_MESSAGE,
        )


def _streak_event_payload(streak_value: int) -> dict:
    if streak_value >= 365:
        icon = "👑"
    elif streak_value >= 100:
        icon = "🚀"
    elif streak_value >= 30:
        icon = "🏆"
    else:
        icon = "🔥"
    return {
        "icon": icon,
        "title": f"{icon} Day {streak_value} Streak",
        "message": f"You're on a {streak_value} day streak. Keep building your network.",
        "current_streak": streak_value,
    }


@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
async def signup(body: SignupRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == body.email))

    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    role = (
        UserRole(body.role)
        if body.role in UserRole.__members__
        else UserRole.developer
    )

    user = User(
        username=generate_username(body.email, body.name),
        email=body.email,
        name=body.name,
        hashed_password=get_password_hash(body.password),
        role=role,
        skills=body.skills or [],
        city=body.city,
        state=body.state,
        country=body.country,
        college=body.college,
        company=body.company,
        role_details=body.role_details or {},
        is_email_verified=False,
    )

    db.add(user)
    await db.flush()

    await ensure_referral_code(db, user)
    await apply_referral_on_signup(db, user, body.referral_code)

    token = _issue_email_verification_token(user)
    await db.flush()
    email_sent = await send_verification_email(user.email, user.name, _verification_url(token))
    
    if not email_sent:
        logger.error(f"[AUTH] Failed to send verification email to {user.email} during signup")

    return SignupResponse(
        message="Check your email to verify your account.",
        email=user.email,
    )


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    logger.info(f"[AUTH] Login attempt for email: {body.email}")
    
    try:
        logger.debug(f"[AUTH] Querying database for user with email: {body.email}")
        result = await db.execute(
            select(User).where(User.email == body.email)
        )
        logger.debug(f"[AUTH] Database query completed for email: {body.email}")

        user = result.scalar_one_or_none()
        logger.debug(f"[AUTH] User found: {user is not None}")

        if not user:
            logger.warning(f"[AUTH] Login failed: User not found for email: {body.email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )
        
        if not user.hashed_password:
            logger.warning(f"[AUTH] Login failed: No hashed password for user: {body.email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        logger.debug(f"[AUTH] Verifying password for user: {body.email}")
        is_valid = verify_password(body.password, user.hashed_password)
        logger.debug(f"[AUTH] Password verification result: {is_valid}")
        
        if not is_valid:
            logger.warning(f"[AUTH] Login failed: Invalid password for email: {body.email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        if user.is_suspended or user.is_banned:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account has been suspended. Please contact support.",
            )

        _require_email_verified(user)

        logger.info(f"[AUTH] Password verified for user: {body.email}")
        streak_update = await apply_login_streak(db, user)
        logger.debug(f"[AUTH] Creating access token for user: {user.id}")
        token = create_access_token(str(user.id))
        
        logger.debug(f"[AUTH] Creating refresh token for user: {user.id}")
        refresh = create_refresh_token(str(user.id))

        logger.info(f"[AUTH] Login successful for user: {user.email} (ID: {user.id})")
        return TokenResponse(
            access_token=token,
            refresh_token=refresh,
            user=to_user_response(user),
            streak_event=_streak_event_payload(streak_update.current_streak)
            if streak_update.incremented_today
            else None,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[AUTH] Unexpected error during login for {body.email}: {e.__class__.__name__}", exc_info=e)
        raise


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(body: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )
    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    if user.is_suspended or user.is_banned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been suspended. Please contact support.",
        )

    _require_email_verified(user)

    access = create_access_token(str(user.id))
    new_refresh = create_refresh_token(str(user.id))
    return TokenResponse(
        access_token=access,
        refresh_token=new_refresh,
        user=to_user_response(user),
    )


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if user and user.hashed_password:
        token = secrets.token_urlsafe(32)
        user.password_reset_token = token
        user.password_reset_expires = datetime.now(timezone.utc) + timedelta(hours=1)
        await db.flush()
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        await send_password_reset_email(user.email, user.name, reset_url)
    return MessageResponse(
        message="If an account exists for that email, a reset link has been sent."
    )


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(User.password_reset_token == body.token)
    )
    user = result.scalar_one_or_none()
    if not user or not user.password_reset_expires:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")
    if user.password_reset_expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")

    user.hashed_password = get_password_hash(body.password)
    user.password_reset_token = None
    user.password_reset_expires = None
    await db.flush()
    return MessageResponse(message="Password updated successfully")


@router.get("/verify-email", response_model=MessageResponse)
async def verify_email(token: str, db: AsyncSession = Depends(get_db)):
    if not token.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification token")

    result = await db.execute(select(User).where(User.email_verification_token == token))
    user = result.scalar_one_or_none()
    if not user or not user.email_verification_expires:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification token")
    if user.email_verification_expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification token")

    user.is_email_verified = True
    user.email_verification_token = None
    user.email_verification_expires = None
    await db.flush()
    await send_welcome_email(user.email, user.name)

    return MessageResponse(message="Email verified successfully. You can now log in.")


@router.post("/resend-verification", response_model=MessageResponse)
async def resend_verification(body: ResendVerificationRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if user and not user.is_email_verified and user.hashed_password:
        token = _issue_email_verification_token(user)
        await db.flush()
        email_sent = await send_verification_email(user.email, user.name, _verification_url(token))
        
        if not email_sent:
            logger.error(f"[AUTH] Failed to send verification email to {user.email} during resend")
    return MessageResponse(
        message="If an unverified account exists for that email, a verification link has been sent."
    )


@router.post("/logout", response_model=MessageResponse)
async def logout(_: CurrentUser):
    return MessageResponse(message="Logged out successfully")


@router.post("/google", response_model=TokenResponse)
async def google_auth(
    body: GoogleAuthRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        token_info = id_token.verify_oauth2_token(
            body.id_token,
            requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )

        email = token_info["email"]
        name = token_info.get("name", email.split("@")[0])
        google_id = token_info.get("sub")
        picture = token_info.get("picture")
        email_verified_by_google = bool(token_info.get("email_verified", False))

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token",
        )

    result = await db.execute(
        select(User).where(User.email == email)
    )

    user = result.scalar_one_or_none()

    if not user:
        user = User(
            username=generate_username(email, name),
            email=email,
            name=name,
            role=UserRole.developer,
            skills=[],
            google_id=google_id,
            profile_image=picture,
            is_email_verified=email_verified_by_google,
        )
        db.add(user)
        await db.flush()
    else:
        if google_id:
            user.google_id = google_id
        if picture and not user.profile_image:
            user.profile_image = picture
        if name and user.name == user.email.split("@")[0]:
            user.name = name
        if email_verified_by_google and not user.is_email_verified:
            user.is_email_verified = True
            user.email_verification_token = None
            user.email_verification_expires = None
        await db.flush()

    if user.is_suspended or user.is_banned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been suspended. Please contact support.",
        )

    streak_update = await apply_login_streak(db, user)
    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=to_user_response(user),
        streak_event=_streak_event_payload(streak_update.current_streak)
        if streak_update.incremented_today
        else None,
    )
