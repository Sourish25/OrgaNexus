"""
Automated Email Scheduler — organizers upload recipient lists and schedule email blasts.
Data is stored in JSON. Recipient data is parsed from CSV/Excel uploads.
"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from api.auth import get_current_user
from database import save_scheduled_email, get_scheduled_emails, delete_scheduled_email, get_event_by_id
import pandas as pd
import io
import json
import os
from pathlib import Path
from datetime import datetime, timezone
from google import genai

router = APIRouter(prefix="/emails", tags=["emails"])

class GenerateEmailRequest(BaseModel):
    event_id: str
    prompt: str

@router.post("/generate-copy")
async def generate_email_copy(req: GenerateEmailRequest, current_user: dict = Depends(get_current_user)):
    """Generate email subject and body using AI based on event context."""
    event = get_event_by_id(req.event_id, current_user["id"])
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    api_key = os.getenv("GEMINI_API_KEY_COMMS")
    if not api_key:
        raise HTTPException(status_code=500, detail="Gemini API Key for Comms not configured")
    
    # Extract full context
    results = event.get("results", {})
    context = {
        "title": event["title"],
        "schedule": results.get("master_schedule", []),
        "logistics": results.get("logistics", {}),
        "content": results.get("content_outputs", {})
    }

    system_instruction = f"""
    You are an expert event copywriter for the event: '{event['title']}'.
    Based on the FULL event context (schedule, logistics, etc.) and the user's specific request, generate a professional email.
    
    IMPORTANT: 
    1. If the user asks about a specific activity, look up the exact time in the schedule.
    2. If the user mentions a time or day to send the email (e.g. "schedule for tomorrow 9 AM"), extract that into 'suggested_send_time'.
    3. Return 'suggested_send_time' in ISO 8601 format (YYYY-MM-DDTHH:MM). If not mentioned, leave it null.

    FORMATTING REQUIREMENTS:
    - Use multiple newlines (`\n`) to separate paragraphs so the email is spacious.
    - NEVER combine lists or schedules into single continuous sentences separated by semicolons.
    - Format lists (like schedules) using bullet points on separate lines (e.g. `\n- Day 1 10:00 AM: Session Name`).
    """
    
    schema = {
        "type": "OBJECT",
        "properties": {
            "subject": {"type": "STRING", "description": "Catchy email subject line"},
            "body": {"type": "STRING", "description": "Professional email body content"},
            "suggested_send_time": {"type": "STRING", "description": "ISO 8601 timestamp or null"}
        },
        "required": ["subject", "body", "suggested_send_time"]
    }
    
    user_prompt = f"""
    Event Context: {json.dumps(context)}
    User Request: {req.prompt}
    Current Time: {datetime.now(timezone.utc).isoformat()}
    """
    
    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-3.1-flash-lite-preview",
            contents=user_prompt,
            config={
                "system_instruction": system_instruction,
                "response_mime_type": "application/json",
                "response_json_schema": schema,
            }
        )
        return response.parsed
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Generation failed: {str(e)}")

DATA_DIR = Path(__file__).parent.parent / "data" / "email_recipients"

@router.post("/schedule")
async def schedule_email(
    event_id: str = Form(...),
    subject: str = Form(...),
    body: str = Form(...),
    send_time: str = Form(""),  # Optional, default to immediate
    manual_emails: str = Form(""),  # Comma or newline separated
    smtp_user: str = Form(""),  # Custom SMTP user
    smtp_password: str = Form(""),  # Custom SMTP password
    files: list[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user)
):
    """Schedule an email blast with multiple files and/or manual email lists."""
    all_recipients = []

    # 1. Process Manual Emails
    if manual_emails:
        # Split by comma or newline and strip whitespace
        manual_list = [e.strip() for e in manual_emails.replace(",", "\n").split("\n") if e.strip()]
        all_recipients.extend(manual_list)

    # 2. Process Files
    saved_paths = []
    if files:
        for file in files:
            contents = await file.read()
            try:
                if file.filename.endswith(".xlsx"):
                    df = pd.read_excel(io.BytesIO(contents))
                else:
                    df = pd.read_csv(io.BytesIO(contents))
                
                # Find email column
                email_col = next((c for c in df.columns if "email" in c.lower()), None)
                if email_col:
                    all_recipients.extend(df[email_col].dropna().astype(str).tolist())
                
                # Save file for record
                DATA_DIR.mkdir(parents=True, exist_ok=True)
                path = DATA_DIR / f"{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{file.filename}"
                df.to_csv(path, index=False)
                saved_paths.append(str(path))

            except Exception as e:
                logger.error(f"Error processing file {file.filename}: {str(e)}")

    if not all_recipients:
        raise HTTPException(status_code=400, detail="No valid recipient emails found in files or manual list.")

    # Deduplicate
    all_recipients = list(set(all_recipients))
    
    # 3. Handle Immediate Sending
    if not send_time or send_time.strip() == "":
        send_time = datetime.now(timezone.utc).isoformat()

    # We'll save a combined csv for the worker to process
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    combined_filename = f"blast_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}.csv"
    combined_path = DATA_DIR / combined_filename
    pd.DataFrame({"email": all_recipients}).to_csv(combined_path, index=False)
    
    smtp_config = {
        "smtp_user": smtp_user,
        "smtp_password": smtp_password
    } if smtp_user and smtp_password else None

    email_entry = save_scheduled_email(
        user_id=current_user["id"],
        event_id=event_id,
        subject=subject,
        body=body,
        recipients_csv_path=str(combined_path),
        send_time=send_time,
        smtp_config=smtp_config
    )
    
    return {
        **email_entry,
        "recipient_count": len(all_recipients),
        "recipients_preview": all_recipients[:5],
    }

@router.get("/scheduled")
async def list_scheduled_emails(current_user: dict = Depends(get_current_user)):
    """Get all scheduled emails for the current organizer."""
    emails = get_scheduled_emails(current_user["id"])
    return emails

class SmtpTestRequest(BaseModel):
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None

@router.post("/test-smtp")
async def test_smtp(req: SmtpTestRequest, current_user: dict = Depends(get_current_user)):
    """Test the SMTP connection using provided credentials or defaulting to .env."""
    smtp_config = {
        "smtp_user": req.smtp_user,
        "smtp_password": req.smtp_password
    } if req.smtp_user and req.smtp_password else None

    success, message = test_smtp_connection(config=smtp_config)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"status": "success", "message": message}

@router.delete("/{email_id}")
async def remove_scheduled_email(email_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a scheduled email."""
    success = delete_scheduled_email(email_id, current_user["id"])
    if not success:
        raise HTTPException(status_code=404, detail="Scheduled email not found")
    return {"status": "deleted"}
