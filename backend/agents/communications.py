from langchain_core.messages import AIMessage
from .state import EventState
from typing import Dict, Any
import json
import logging
import os
from google import genai

logger = logging.getLogger(__name__)

def communications_node(state: EventState) -> Dict[str, Any]:
    """
    The Communications & Targeted Mailing Agent.
    Personalizes drafts and manages automated bulk distributions.
    """
    logger.info("--- COMMUNICATIONS & TARGETED MAILING AGENT ---")
    draft_base = state.get("email_draft_base", "")
    reg_data = state.get("registration_data", [])
    schedule = state.get("master_schedule", [])
    event_title = state.get("event_title", "Untitled Event")
    
    if not reg_data and not draft_base:
        return {"current_error": "No registration data or email draft provided."}
        
    api_key = os.getenv("GEMINI_API_KEY_COMMS")
    if not api_key:
        return {"current_error": "GEMINI_API_KEY_COMMS not configured in .env."}

    system_instruction = f"""
    You are the Communications Agent for the event: '{event_title}'.
    Based on the Base Draft and the specific User Data, generate a personalized email for the user.
    If there is a new master schedule provided, append a brief note pointing it out.
    CRITICAL DRIFT: Pay close attention to any real-time 'Pulse Events'. If there are recent room changes, leaks, or late speakers, you must draft an URGENT Push/SMS/WhatsApp alert as the 'personalized_body' notifying attendees about the change immediately.

    FORMATTING REQUIREMENTS:
    - Use actual line break control characters to separate paragraphs so the email is spacious and readable.
    - NEVER combine lists into a single continuous sentence separated by semicolons.
    - Format lists (like schedules) using bullet points on separate lines starting with a hyphen (e.g. - Day 1 10:00 AM).
    """
    
    # Define the schema for structured output
    emails_schema = {
        "type": "ARRAY",
        "items": {
            "type": "OBJECT",
            "properties": {
                "email": {"type": "STRING", "description": "User email address"},
                "personalized_subject": {"type": "STRING", "description": "Subject line for the email"},
                "personalized_body": {"type": "STRING", "description": "Entire customized email body"}
            },
            "required": ["email", "personalized_subject", "personalized_body"]
        }
    }
    
    pulse_events = state.get("pulse_events", [])
    user_prompt = f"""
    Event Title: {event_title}
    Base Draft: {draft_base}
    Schedule Snippet: {json.dumps(schedule)}
    User Data: {json.dumps(reg_data)}
    Recent Real-Time Pulse Events (Drift): {json.dumps(pulse_events)}
    """
    
    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-3.1-flash-lite-preview",
            contents=user_prompt,
            config={
                "system_instruction": system_instruction,
                "response_mime_type": "application/json",
                "response_json_schema": emails_schema,
            }
        )
        
        emails = response.parsed
        
        return {
            "sent_emails": emails,
            "next_agent": None,
            "messages": [AIMessage(content=f"Successfully personalized and distributed communications for '{event_title}' to {len(emails)} attendees.", name="Communications")]
        }
    except Exception as e:
        logger.error(f"Error in Communications: {str(e)}")
        return {"current_error": f"Communications failed: {str(e)}"}
