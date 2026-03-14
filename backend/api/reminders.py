"""
Event Reminders API — organizers can create/manage reminders for participants.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from api.auth import get_current_user
from database import save_reminder, get_reminders_by_event, delete_reminder

router = APIRouter(prefix="/reminders", tags=["reminders"])

class ReminderCreate(BaseModel):
    event_id: str
    message: str
    scheduled_time: str  # ISO 8601 format, e.g. "2026-03-15T10:00:00"
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None

@router.post("/")
async def create_reminder(request: ReminderCreate, current_user: dict = Depends(get_current_user)):
    """Create a new reminder for an event."""
    smtp_config = {
        "smtp_user": request.smtp_user,
        "smtp_password": request.smtp_password
    } if request.smtp_user and request.smtp_password else None

    reminder = save_reminder(
        user_id=current_user["id"],
        event_id=request.event_id,
        message=request.message,
        scheduled_time=request.scheduled_time,
        smtp_config=smtp_config
    )
    return reminder

@router.get("/{event_id}")
async def list_reminders(event_id: str, current_user: dict = Depends(get_current_user)):
    """Get all reminders for a specific event."""
    reminders = get_reminders_by_event(event_id, current_user["id"])
    return reminders

@router.delete("/{reminder_id}")
async def remove_reminder(reminder_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a reminder."""
    success = delete_reminder(reminder_id, current_user["id"])
    if not success:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return {"status": "deleted"}
