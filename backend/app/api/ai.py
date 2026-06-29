from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from app.services.ai_bot import AIHomeworkBot, DictionaryService
from app.dependencies.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/ai", tags=["ai"])

ai_bot = AIHomeworkBot()
dictionary = DictionaryService()

class HomeworkQuestion(BaseModel):
    question: str
    subject: Optional[str] = None
    grade: Optional[str] = None

class WordRequest(BaseModel):
    word: str

@router.post("/homework-help")
async def get_homework_help(
    request: HomeworkQuestion,
    current_user: User = Depends(get_current_user)
):
    return await ai_bot.get_help(request.question, request.subject, request.grade)

@router.post("/dictionary/define")
async def define_word(
    request: WordRequest,
    current_user: User = Depends(get_current_user)
):
    return await dictionary.define_word(request.word)