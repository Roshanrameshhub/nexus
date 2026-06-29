from fastapi import WebSocket, WebSocketDisconnect, APIRouter, Depends
from typing import Dict, Set
import json
import asyncio
from app.dependencies.auth import get_current_user_ws
from app.db.database import get_db
from sqlalchemy.orm import Session
from app.models.meeting import Meeting, MeetingParticipant, QnA
from app.models.user import User

router = APIRouter()

class MeetingManager:
    def __init__(self):
        self.active_meetings: Dict[int, Dict] = {}  # meeting_id -> {speaker_ws, attendees: Set[ws]}
        self.meeting_attendees: Dict[int, Set[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, meeting_id: int, user_id: int, is_speaker: bool):
        await websocket.accept()
        
        if meeting_id not in self.active_meetings:
            self.active_meetings[meeting_id] = {
                "speaker": None,
                "attendees": set(),
                "speaker_muted": False
            }
        
        if is_speaker:
            # If speaker already exists, disconnect old one
            if self.active_meetings[meeting_id]["speaker"]:
                old_speaker = self.active_meetings[meeting_id]["speaker"]
                await old_speaker.close()
            self.active_meetings[meeting_id]["speaker"] = websocket
        else:
            self.active_meetings[meeting_id]["attendees"].add(websocket)
        
        # Store user info
        if meeting_id not in self.meeting_attendees:
            self.meeting_attendees[meeting_id] = set()
        self.meeting_attendees[meeting_id].add(websocket)
        
        # Send initial state
        await websocket.send_json({
            "type": "connection_established",
            "role": "speaker" if is_speaker else "attendee",
            "meeting_id": meeting_id
        })
    
    def disconnect(self, websocket: WebSocket, meeting_id: int):
        if meeting_id in self.active_meetings:
            if self.active_meetings[meeting_id]["speaker"] == websocket:
                self.active_meetings[meeting_id]["speaker"] = None
            if websocket in self.active_meetings[meeting_id]["attendees"]:
                self.active_meetings[meeting_id]["attendees"].remove(websocket)
        
        if meeting_id in self.meeting_attendees:
            if websocket in self.meeting_attendees[meeting_id]:
                self.meeting_attendees[meeting_id].remove(websocket)
    
    async def broadcast_to_meeting(self, meeting_id: int, message: dict, exclude: WebSocket = None):
        """Broadcast to all in meeting except speaker (speaker sees comments differently)"""
        if meeting_id not in self.active_meetings:
            return
        
        attendees = self.active_meetings[meeting_id]["attendees"]
        speaker = self.active_meetings[meeting_id]["speaker"]
        
        # Send to all attendees
        for attendee in attendees:
            if attendee != exclude:
                try:
                    await attendee.send_json(message)
                except:
                    pass
        
        # Send to speaker with different format if needed
        if speaker and speaker != exclude:
            try:
                await speaker.send_json(message)
            except:
                pass
    
    async def send_to_speaker(self, meeting_id: int, message: dict):
        """Send message specifically to speaker"""
        if meeting_id in self.active_meetings:
            speaker = self.active_meetings[meeting_id]["speaker"]
            if speaker:
                try:
                    await speaker.send_json(message)
                except:
                    pass
    
    async def toggle_speaker_mute(self, meeting_id: int):
        """Mute/unmute speaker"""
        if meeting_id in self.active_meetings:
            self.active_meetings[meeting_id]["speaker_muted"] = not self.active_meetings[meeting_id]["speaker_muted"]
            muted = self.active_meetings[meeting_id]["speaker_muted"]
            
            # Broadcast mute status to all attendees
            await self.broadcast_to_meeting(meeting_id, {
                "type": "speaker_mute_toggle",
                "muted": muted
            })
            
            return muted

meeting_manager = MeetingManager()

@router.websocket("/ws/meeting/{meeting_id}")
async def websocket_meeting(
    websocket: WebSocket,
    meeting_id: int,
    token: str
):
    """WebSocket endpoint for meeting"""
    
    try:
        # Authenticate user
        user = await get_current_user_ws(token)
        if not user:
            await websocket.close(code=4001)
            return
        
        # Get meeting details
        db = next(get_db())
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
        if not meeting:
            await websocket.close(code=4004)
            return
        
        # Check if user is speaker or attendee
        is_speaker = (meeting.speaker_id == user.id)
        
        # Check if attendee can join (max limit)
        if not is_speaker:
            participant_count = db.query(MeetingParticipant).filter(
                MeetingParticipant.meeting_id == meeting_id
            ).count()
            
            if participant_count >= meeting.max_attendees:
                await websocket.close(code=4003)
                return
        
        # Connect to meeting
        await meeting_manager.connect(websocket, meeting_id, user.id, is_speaker)
        
        # Add participant to database
        participant = MeetingParticipant(
            meeting_id=meeting_id,
            user_id=user.id,
            is_speaker=is_speaker,
            joined_at=datetime.utcnow()
        )
        db.add(participant)
        db.commit()
        
        try:
            while True:
                data = await websocket.receive_text()
                message = json.loads(data)
                
                if message["type"] == "question":
                    # Attendee asks a question
                    question_data = message["data"]
                    
                    # Store in database
                    qna = QnA(
                        meeting_id=meeting_id,
                        user_id=user.id,
                        question=question_data["question"]
                    )
                    db.add(qna)
                    db.commit()
                    
                    # Send to speaker
                    await meeting_manager.send_to_speaker(meeting_id, {
                        "type": "new_question",
                        "data": {
                            "id": qna.id,
                            "question": qna.question,
                            "asked_by": user.full_name,
                            "timestamp": datetime.utcnow().isoformat()
                        }
                    })
                    
                    # Acknowledge to attendee
                    await websocket.send_json({
                        "type": "question_submitted",
                        "id": qna.id
                    })
                
                elif message["type"] == "answer":
                    # Speaker answers a question
                    answer_data = message["data"]
                    
                    qna = db.query(QnA).filter(QnA.id == answer_data["qna_id"]).first()
                    if qna:
                        qna.answer = answer_data["answer"]
                        qna.is_answered = True
                        db.commit()
                        
                        # Broadcast answer to all attendees
                        await meeting_manager.broadcast_to_meeting(meeting_id, {
                            "type": "answer",
                            "data": {
                                "qna_id": qna.id,
                                "question": qna.question,
                                "answer": qna.answer
                            }
                        })
                
                elif message["type"] == "comment":
                    # Attendee comment (public)
                    comment_data = message["data"]
                    
                    # Broadcast to all attendees (visible to everyone)
                    await meeting_manager.broadcast_to_meeting(meeting_id, {
                        "type": "comment",
                        "data": {
                            "user": user.full_name,
                            "comment": comment_data["comment"],
                            "timestamp": datetime.utcnow().isoformat()
                        }
                    })
                
                elif message["type"] == "speaker_toggle_mute" and is_speaker:
                    muted = await meeting_manager.toggle_speaker_mute(meeting_id)
                    await websocket.send_json({
                        "type": "mute_status",
                        "muted": muted
                    })
        
        except WebSocketDisconnect:
            meeting_manager.disconnect(websocket, meeting_id)
            db.query(MeetingParticipant).filter(
                MeetingParticipant.meeting_id == meeting_id,
                MeetingParticipant.user_id == user.id
            ).update({"left_at": datetime.utcnow()})
            db.commit()
            
            # Notify others that someone left
            await meeting_manager.broadcast_to_meeting(meeting_id, {
                "type": "user_left",
                "user": user.full_name
            })
    
    except Exception as e:
        print(f"WebSocket error: {e}")
        await websocket.close()