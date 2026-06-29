from pydantic import BaseModel, Field, UUID4
from typing import Optional, List
from datetime import datetime

# School Schemas
class SchoolBase(BaseModel):
    name: str
    description: Optional[str] = None
    address: Optional[str] = None

class SchoolCreate(SchoolBase):
    admin_id: Optional[UUID4] = None

class SchoolResponse(SchoolBase):
    id: UUID4
    admin_id: UUID4
    verification_status: str
    created_at: datetime

    class Config:
        from_attributes = True

# Classroom Schemas
class ClassroomBase(BaseModel):
    name: str
    school_id: UUID4
    grade: Optional[str] = None
    section: Optional[str] = None

class ClassroomCreate(ClassroomBase):
    teacher_id: Optional[UUID4] = None

class ClassroomResponse(ClassroomBase):
    id: UUID4
    teacher_id: UUID4
    join_code: str
    created_at: datetime

    class Config:
        from_attributes = True

# Homework Schemas
class HomeworkBase(BaseModel):
    title: str
    description: Optional[str] = None
    classroom_id: UUID4
    due_date: Optional[datetime] = None
    attachments: Optional[List[str]] = None

class HomeworkCreate(HomeworkBase):
    teacher_id: Optional[UUID4] = None

class HomeworkResponse(HomeworkBase):
    id: UUID4
    teacher_id: UUID4
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# HomeworkView Schemas
class HomeworkViewResponse(BaseModel):
    id: UUID4
    homework_id: UUID4
    student_id: UUID4
    viewed_at: datetime
    time_spent: int
    last_viewed: datetime
    view_count: int

    class Config:
        from_attributes = True