from datetime import datetime
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


UserRoleType = Literal["founder", "developer", "mentor", "student", "executive", "investor"]


class UserBase(BaseModel):
    name: str
    email: EmailStr
    bio: Optional[str] = None
    skills: List[str] = []
    avatar: Optional[str] = None
    role: UserRoleType = "developer"
    country: Optional[str] = None
    college: Optional[str] = None
    company: Optional[str] = None
    role_details: Optional[dict] = None


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=8)
    role: Optional[UserRoleType] = "developer"
    skills: List[str] = []
    country: Optional[str] = None
    college: Optional[str] = None
    company: Optional[str] = None
    role_details: Optional[dict] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    skills: Optional[List[str]] = None
    avatar: Optional[str] = None
    role: Optional[UserRoleType] = None
    github_username: Optional[str] = None
    country: Optional[str] = None
    college: Optional[str] = None
    company: Optional[str] = None
    role_details: Optional[dict] = None


class UserResponse(UserBase):
    id: UUID
    github_username: Optional[str] = None

    model_config = {"from_attributes": True}


class UserPublic(BaseModel):
    id: UUID
    name: str
    email: Optional[EmailStr] = None
    bio: Optional[str] = None
    skills: List[str] = []
    avatar: Optional[str] = None
    role: UserRoleType
    github_username: Optional[str] = None
    created_at: Optional[datetime] = None
    country: Optional[str] = None
    college: Optional[str] = None
    company: Optional[str] = None
    role_details: Optional[dict] = None

    model_config = {"from_attributes": True}


class UserRecommendation(BaseModel):
    id: UUID
    name: str
    role: UserRoleType
    email: Optional[str] = None
    avatar: Optional[str] = None
    bio: Optional[str] = None
    skills: List[str] = []
    match: str = "90%"
    following: bool = False
    country: Optional[str] = None
    college: Optional[str] = None
    company: Optional[str] = None
    role_details: Optional[dict] = None
    match_factors: List[str] = []
