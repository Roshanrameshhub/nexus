from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from app.schemas.user import UserResponse


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=8)
    role: Optional[str] = "developer"
    skills: list[str] = []
    country: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    college: Optional[str] = None
    company: Optional[str] = None
    role_details: Optional[dict] = None
    referral_code: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    user: UserResponse
    streak_event: Optional[dict] = None


class GoogleAuthRequest(BaseModel):
    id_token: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str = Field(min_length=8)


class MessageResponse(BaseModel):
    message: str


class SignupResponse(BaseModel):
    message: str
    email: EmailStr


class ResendVerificationRequest(BaseModel):
    email: EmailStr
