from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel

from app.schemas.user import UserPublic


class ReactionResponse(BaseModel):
    id: UUID
    reaction_type: str
    user: Optional[UserPublic] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ReactionCreate(BaseModel):
    reaction_type: str


class ReactionBreakdown(BaseModel):
    like: int = 0
    celebrate: int = 0
    insightful: int = 0
    innovative: int = 0
    support: int = 0
    useful: int = 0


class PostReactionResponse(ReactionResponse):
    pass


class CommentReactionResponse(ReactionResponse):
    pass


class MessageReactionResponse(ReactionResponse):
    pass
