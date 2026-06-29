from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.database import Base

class School(Base):
    __tablename__ = "schools"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(Text)
    address = Column(String)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    verification_status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    admin = relationship("User", foreign_keys=[admin_id])
    classrooms = relationship("Classroom", back_populates="school")

class Classroom(Base):
    __tablename__ = "classrooms"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    school_id = Column(UUID(as_uuid=True), ForeignKey("schools.id"))
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    grade = Column(String)
    section = Column(String)
    join_code = Column(String, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    school = relationship("School", back_populates="classrooms")
    teacher = relationship("User", foreign_keys=[teacher_id])
    homework = relationship("Homework", back_populates="classroom")

class Homework(Base):
    __tablename__ = "homework"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    description = Column(Text)
    classroom_id = Column(UUID(as_uuid=True), ForeignKey("classrooms.id"))
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    due_date = Column(DateTime)
    attachments = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    
    classroom = relationship("Classroom", back_populates="homework")
    teacher = relationship("User", foreign_keys=[teacher_id])
    views = relationship("HomeworkView", back_populates="homework")

# ✅ ADD THIS MODEL
class HomeworkView(Base):
    __tablename__ = "homework_views"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    homework_id = Column(UUID(as_uuid=True), ForeignKey("homework.id"))
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    viewed_at = Column(DateTime, default=datetime.utcnow)
    time_spent = Column(Integer, default=0)
    last_viewed = Column(DateTime, default=datetime.utcnow)
    view_count = Column(Integer, default=1)
    
    homework = relationship("Homework", back_populates="views")
    student = relationship("User", foreign_keys=[student_id])