from langchain_core.messages import AIMessage
from .state import EventState
from typing import Dict, Any
import logging
import os
import json
from dotenv import load_dotenv
from google import genai

load_dotenv()
logger = logging.getLogger(__name__)

def roi_agent_node(state: EventState) -> Dict[str, Any]:
    """
    The ROI and Summary Agent.
    Calculates detailed participation metrics, theoretical ROI based on logistics budget, 
    and suggests future improvements based on event details.
    """
    logger.info("--- ROI & SUMMARY AGENT ---")
    event_title = state.get("event_title", "Untitled Event")
    event_details = state.get("event_details", "")
    reg_data = state.get("registration_data", [])
    logistics_plan = state.get("logistics_plan", {})
    
    if not event_details:
        return {"current_error": "No event details provided for ROI Agent."}
        
    api_key = os.getenv("GEMINI_API_KEY_CONTENT") or os.getenv("GEMINI_API_KEY_ROUTER")
    if not api_key:
        return {"current_error": "No GEMINI_API_KEY configured for ROI Agent."}

    system_instruction = f"""
    You are the 'ROI & Event Summary Agent' for the event: '{event_title}'.
    Your job is to provide a comprehensive management overview based on available data.
    
    You must output a structured JSON containing:
    1. An executive summary of the event positioning.
    2. Detailed participation metrics (deduced from attendee CSV data).
    3. ROI Estimation (compare the logistical budget vs potential value).
    4. 3-5 concrete actionable Future Improvements based on the constraints or details of the event.
    """
    
    # Define the schema for structured output
    roi_schema = {
        "type": "OBJECT",
        "properties": {
            "executive_summary": {"type": "STRING", "description": "1-2 paragraph management summary of the event."},
            "detailed_participation": {
                "type": "OBJECT", 
                "properties": {
                    "total_attendees": {"type": "INTEGER"},
                    "key_demographics": {"type": "STRING", "description": "Summary of roles/companies represented (e.g., 'Heavy presence of AI startups')"}
                }
            },
            "roi_estimation": {"type": "STRING", "description": "A theoretical breakdown of the ROI based on the estimated budget vs outcomes."},
            "future_improvements": {
                "type": "ARRAY",
                "items": {"type": "STRING"},
                "description": "3-5 concrete actionable points for next year."
            }
        },
        "required": ["executive_summary", "detailed_participation", "roi_estimation", "future_improvements"]
    }
    
    # Provide metrics on attendees if available
    attendee_info = "No registration data available."
    if reg_data:
        num_attendees = len(reg_data)
        sample = reg_data[:15] # Give a sample to deduce demographics
        attendee_info = f"Total Attendees: {num_attendees}\nSample Participant Data for demographics: {json.dumps(sample)}"
    
    # Format logistics if available
    budget_info = "No budget constraints specified."
    if logistics_plan:
        budget_info = f"Estimated Budget: {logistics_plan.get('estimated_budget', 'N/A')}\nBottlenecks: {logistics_plan.get('critical_bottlenecks', [])}"
    
    user_prompt = f"""
    Event Title: {event_title}
    Event Details: {event_details}
    
    {attendee_info}
    
    {budget_info}
    """
    
    try:
        from google.genai import types
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-3.1-flash-lite-preview",
            contents=user_prompt,
            config={
                "system_instruction": system_instruction,
                "response_mime_type": "application/json",
                "response_json_schema": roi_schema,
                "thinking_config": types.ThinkingConfig(thinking_level="high")
            }
        )
        
        result = response.parsed
        
        return {
            "roi_summary": result,
            "messages": [AIMessage(content=f"Generated an ROI and Executive Summary for '{event_title}'.", name="ROIAgent")]
        }
    except Exception as e:
        logger.error(f"Error in ROI Agent: {str(e)}")
        return {"current_error": f"ROI agent failed: {str(e)}"}
