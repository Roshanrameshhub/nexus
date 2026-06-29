from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, Enum, Boolean, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from app.database import Base

class BugStatus(enum.Enum):
    reported = "reported"
    in_progress = "in_progress"
    fixed = "fixed"
    verified = "verified"
    closed = "closed"

class BugPriority(enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"

class BugSeverity(enum.Enum):
    minor = "minor"
    major = "major"
    critical = "critical"
    blocker = "blocker"

class BugCategory(enum.Enum):
    ui_ux = "ui_ux"
    functionality = "functionality"
    performance = "performance"
    security = "security"
    database = "database"
    integration = "integration"
    other = "other"

class Bug(Base):
    __tablename__ = "bugs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Basic Info
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    steps_to_reproduce = Column(Text)
    expected_behavior = Column(Text)
    actual_behavior = Column(Text)
    
    # Classification
    category = Column(Enum(BugCategory), default=BugCategory.other)
    severity = Column(Enum(BugSeverity), default=BugSeverity.major)
    priority = Column(Enum(BugPriority), default=BugPriority.medium)
    
    # Status
    status = Column(Enum(BugStatus), default=BugStatus.reported)
    is_reproducible = Column(Boolean, default=True)
    
    # Environment
    browser = Column(String(100))
    os = Column(String(100))
    device = Column(String(100))
    screen_resolution = Column(String(50))
    
    # Screenshots and Attachments
    screenshot_urls = Column(JSON, default=list)  # Array of image URLs
    attachments = Column(JSON, default=list)  # Array of file URLs
    
    # User Relations
    reported_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    verified_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    verified_at = Column(DateTime, nullable=True)
    
    # Notes
    resolution_notes = Column(Text)
    internal_notes = Column(Text)
    
    # Relationships
    reporter = relationship("User", foreign_keys=[reported_by], backref="reported_bugs")
    assignee = relationship("User", foreign_keys=[assigned_to], backref="assigned_bugs")
    verifier = relationship("User", foreign_keys=[verified_by], backref="verified_bugs")