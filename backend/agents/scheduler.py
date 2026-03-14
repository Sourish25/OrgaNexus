from langchain_core.messages import AIMessage
from .state import EventState
from typing import Dict, Any
import json
import logging
import os
from google import genai

logger = logging.getLogger(__name__)

def scheduler_node(state: EventState) -> Dict[str, Any]:
    """
    The Dynamic Scheduler & Conflict Resolver Agent.
    Manages master timeline, resolves overlaps.
    """
    logger.info("--- DYNAMIC SCHEDULER & CONFLICT RESOLVER ---")
    constraints = state.get("scheduling_constraints") or ""
    existing_schedule = state.get("master_schedule") or []
    event_details = state.get("event_details") or ""
    event_title = state.get("event_title") or "Untitled Event"
    
    if not constraints and not existing_schedule and not event_details:
        return {"current_error": "No scheduling constraints or event details provided."}
        
    if not constraints and event_details:
        constraints = f"Extract a master schedule based on these general event details:\n{event_details}"
        
    api_key = os.getenv("GEMINI_API_KEY_SCHEDULER")
    if not api_key:
        return {"current_error": "GEMINI_API_KEY_SCHEDULER not configured in .env."}

    system_instruction = f"""
    You are the Master Scheduler Agent for the event: '{event_title}'.
    Build a conflict-free schedule based on the input constraints.
    If there are clashes, resolve them logically.
    """
    
    # Define the schema for structured output
    schedule_schema = {
        "type": "ARRAY",
        "items": {
            "type": "OBJECT",
            "properties": {
                "id": {"type": "STRING", "description": "Unique identifier for the session"},
                "title": {"type": "STRING", "description": "Name of the session or event"},
                "speaker": {"type": "STRING", "description": "The speaker for this session"},
                "start_time": {"type": "STRING", "description": "Time the session starts (e.g. Day 1 10:00 AM)"},
                "end_time": {"type": "STRING", "description": "Time the session ends"},
                "location": {"type": "STRING", "description": "Where the session takes place"}
            },
            "required": ["id", "title", "speaker", "start_time", "end_time", "location"]
        }
    }
    
    pulse_events = state.get("pulse_events") or []
    user_prompt = f"Event Title: {event_title}\nConstraints: {constraints}\nRecent Real-Time Drift/Pulse Events: {json.dumps(pulse_events)}\n\nCurrent Schedule: {json.dumps(existing_schedule)}"
    
    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-3.1-flash-lite-preview",
            contents=user_prompt,
            config={
                "system_instruction": system_instruction,
                "response_mime_type": "application/json",
                "response_json_schema": schedule_schema,
            }
        )
        
        if response.text:
            schedule_data = json.loads(response.text)
            return {
                "messages": [AIMessage(content=f"Synthesized master schedule for '{event_title}' with {len(schedule_data)} sessions.", name="Scheduler")],
                "master_schedule": schedule_data
            }
        else:
            return {"current_error": "Scheduler returned empty response."}
            
    except Exception as e:
        logger.error(f"Scheduler Agent Error: {str(e)}")
        return {"current_error": f"Failed to generate schedule: {str(e)}"}
