from langchain_core.messages import AIMessage
from .state import EventState
from typing import Dict, Any
import json
import logging
import os
from google import genai

logger = logging.getLogger(__name__)

def logistics_node(state: EventState) -> Dict[str, Any]:
    """
    The Logistics & Budget Optimization Agent.
    Handles catering, space, and swag.
    """
    logger.info("--- LOGISTICS & BUDGET OPTIMIZATION AGENT ---")
    event_details = state.get("event_details") or ""
    reg_data = state.get("registration_data") or []
    event_title = state.get("event_title") or "Untitled Event"
    
    if not event_details:
        return {"current_error": "No event details provided for Logistics."}
        
    api_key = os.getenv("GEMINI_API_KEY_LOGISTICS")
    if not api_key:
        return {"current_error": "GEMINI_API_KEY_LOGISTICS not configured in .env."}

    system_instruction = f"""
    You are the Logistics & Operations Manager for the event: '{event_title}'.
    Optimize the event's operation based on budget and estimated attendance.
    CRITICAL DRIFT: Pay close attention to any real-time 'Pulse Events'. If there are recent room changes, leaks, or late speakers, you must output an updated logistics plan that immediately re-routes catering, adjust equipment checklists, and mitigates the specific risk mentioned in the drift!
    """
    
    # Define the schema for structured output
    logistics_schema = {
        "type": "OBJECT",
        "properties": {
            "estimated_budget": {"type": "STRING", "description": "Summary of budget allocation"},
            "catering_suggestion": {"type": "STRING", "description": "Plan for food and drinks"},
            "swag_package": {"type": "STRING", "description": "Merchandise and welcome kits"},
            "critical_bottlenecks": {
                "type": "ARRAY",
                "items": {"type": "STRING"},
                "description": "List of potential logistical risks"
            }
        },
        "required": ["estimated_budget", "catering_suggestion", "swag_package", "critical_bottlenecks"]
    }
    
    pulse_events = state.get("pulse_events", [])
    user_prompt = f"Event Title: {event_title}\nDetails: {event_details}\nAttendee Data count: {len(reg_data)}\nRecent Real-Time Pulse Events (Drift): {json.dumps(pulse_events)}"
    
    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-3.1-flash-lite-preview",
            contents=user_prompt,
            config={
                "system_instruction": system_instruction,
                "response_mime_type": "application/json",
                "response_json_schema": logistics_schema,
            }
        )
        
        logistics_data = response.parsed
        
        return {
            "logistics_plan": logistics_data,
            "messages": [AIMessage(content=f"Optimized logistical framework for '{event_title}' based on latest constraints.", name="Logistics")]
        }
    except Exception as e:
        logger.error(f"Error in Logistics: {str(e)}")
        return {"current_error": f"Logistics failed: {str(e)}"}
