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
    ResetPasswordRequest,
    SignupRequest,
    TokenResponse,
)
from app.services.email_service import send_password_reset_email, send_welcome_email
from app.services.referral_service import apply_referral_on_signup, ensure_referral_code
from app.utils.helpers import generate_username
from app.utils.user_mapper import to_user_response

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])

settings = get_settings()


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
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
        country=body.country,
        college=body.college,
        company=body.company,
        role_details=body.role_details or {},
    )

    db.add(user)
    await db.flush()

    await ensure_referral_code(db, user)
    await apply_referral_on_signup(db, user, body.referral_code)
    await db.flush()

    await send_welcome_email(user.email, user.name)

    token = create_access_token(str(user.id))
    refresh = create_refresh_token(str(user.id))

    return TokenResponse(
        access_token=token,
        refresh_token=refresh,
        user=to_user_response(user),
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

        if user.is_suspended:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account suspended",
            )

        logger.info(f"[AUTH] Password verified for user: {body.email}")
        logger.debug(f"[AUTH] Creating access token for user: {user.id}")
        token = create_access_token(str(user.id))
        
        logger.debug(f"[AUTH] Creating refresh token for user: {user.id}")
        refresh = create_refresh_token(str(user.id))

        logger.info(f"[AUTH] Login successful for user: {user.email} (ID: {user.id})")
        return TokenResponse(
            access_token=token,
            refresh_token=refresh,
            user=to_user_response(user),
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

    if user.is_suspended:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account suspended")

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
        await db.flush()

    if user.is_suspended:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account suspended")

    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=to_user_response(user),
    )