from langchain_core.messages import AIMessage
from .state import EventState
from typing import Dict, Any
import logging
import os
from dotenv import load_dotenv
from google import genai

load_dotenv()
logger = logging.getLogger(__name__)

def media_agent_node(state: EventState) -> Dict[str, Any]:
    """
    The Media Agent.
    Interviews the final schedule and registration sheet to find a 'Hook' 
    and writes a formal Press Release in AP Style.
    """
    logger.info("--- MEDIA AGENT ---")
    event_title = state.get("event_title", "Untitled Event")
    event_details = state.get("event_details", "")
    reg_data = state.get("registration_data", [])
    schedule = state.get("master_schedule", [])
    
    if not event_details and not schedule:
        return {"current_error": "No event details or schedule provided for Media Agent."}
        
    api_key = os.getenv("GEMINI_API_KEY_CONTENT") or os.getenv("GEMINI_API_KEY_ROUTER")
    if not api_key:
        return {"current_error": "No GEMINI_API_KEY configured for Media Agent."}

    system_instruction = f"""
    You are 'The Media Agent' for the event: '{event_title}'.
    Every event wants press coverage but hates writing the release. 
    Your strict job is to read the provided CSV (attendee data) and Master Schedule 
    and write a formal Press Release in AP Style.
    
    Crucially, you must find a "Hook" from the data to make the PR interesting.
    Example hook: "With 40% of attendees coming from AI startups, this is the largest gathering of neural engineers this quarter."
    """
    
    # Define the schema for structured output
    pr_schema = {
        "type": "OBJECT",
        "properties": {
            "hook": {"type": "STRING", "description": "The engaging 1-2 sentence hook extracted from the data"},
            "press_release": {"type": "STRING", "description": "The full AP Style Press Release text (200-400 words)"}
        },
        "required": ["hook", "press_release"]
    }
    
    # Provide metrics on attendees if available
    attendee_info = "No registration data available."
    if reg_data:
        total = len(reg_data)
        metrics = {"Total Attendees": total}
        
        # Try to gather generic stats if present in standard CSV fields
        companies = set()
        roles = set()
        locations = set()
        for r in reg_data:
            company = str(r.get("Company", r.get("company", ""))).strip()
            if company and company.lower() != "nan": companies.add(company)
            
            role = str(r.get("Role", r.get("Job Title", r.get("role", "")))).strip()
            if role and role.lower() != "nan": roles.add(role)
            
            loc = str(r.get("Location", r.get("City", r.get("location", "")))).strip()
            if loc and loc.lower() != "nan": locations.add(loc)
            
        if companies: metrics["Unique Companies"] = len(companies)
        if roles: metrics["Unique Roles"] = len(roles)
        if locations: metrics["Unique Locations"] = len(locations)
        
        attendee_info = f"Attendee Metrics:\n{metrics}"
    
    # Format schedule if available
    schedule_info = "No master schedule available."
    if schedule:
        entries = []
        for s in schedule[:10]: # Cap to 10 for context limits
            entries.append(f"- {s.get('start_time', '')}: {s.get('title', '')} by {s.get('speaker', 'TBA')} @ {s.get('location', 'TBA')}")
        schedule_info = "Key Schedule Items:\n" + "\n".join(entries)
    
    user_prompt = f"""
    Event Title: {event_title}
    Event Details: {event_details}
    
    {attendee_info}
    
    {schedule_info}
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
                "response_json_schema": pr_schema,
                "thinking_config": types.ThinkingConfig(thinking_level="high")
            }
        )
        
        result = response.parsed
        full_pr_text = f"**HOOK**: {result.get('hook')}\n\n{result.get('press_release')}"
        
        return {
            "press_release": full_pr_text,
            "messages": [AIMessage(content=f"Generated an AP Style Press Release with hook: '{result.get('hook')}'", name="MediaAgent")]
        }
    except Exception as e:
        logger.error(f"Error in Media Agent: {str(e)}")
        return {"current_error": f"Media agent failed: {str(e)}"}
