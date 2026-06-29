from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, Boolean, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from app.database import Base

class MeetingStatus(enum.Enum):
    scheduled = "scheduled"
    live = "live"
    ended = "ended"
    cancelled = "cancelled"

class Meeting(Base):
    __tablename__ = "meetings"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    description = Column(Text)
    host_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    speaker_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    organizer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # ← ADD THIS
    invitee_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime)
    status = Column(Enum(MeetingStatus), default=MeetingStatus.scheduled)
    max_attendees = Column(Integer, default=100)
    recording_url = Column(String)
    meeting_link = Column(String, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    host = relationship("User", foreign_keys=[host_id])
    speaker = relationship("User", foreign_keys=[speaker_id])
    organizer = relationship("User", foreign_keys=[organizer_id])  # ← ADD THIS
    invitee = relationship("User", foreign_keys=[invitee_id])
    participants = relationship("MeetingParticipant", back_populates="meeting")
    qna = relationship("QnA", back_populates="meeting")

class MeetingParticipant(Base):
    __tablename__ = "meeting_participants"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meetings.id"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    joined_at = Column(DateTime, default=datetime.utcnow)
    left_at = Column(DateTime)
    is_speaker = Column(Boolean, default=False)
    is_muted = Column(Boolean, default=True)
    
    meeting = relationship("Meeting", back_populates="participants")
    user = relationship("User", foreign_keys=[user_id])

class QnA(Base):
    __tablename__ = "qna"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meetings.id"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    question = Column(Text, nullable=False)
    answer = Column(Text)
    is_answered = Column(Boolean, default=False)
    likes = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    meeting = relationship("Meeting", back_populates="qna")
    user = relationship("User", foreign_keys=[user_id])