import logging
import os
import json
from google import genai

logger = logging.getLogger(__name__)

def generate_post_pulse_recap(attendee_name: str, event_title: str, event_details: str, schedule: list, pulse_events: list) -> str:
    """
    Generates a Hyper-Personalized 'Post-Pulse' Recap for a specific attendee.
    This simulates taking an attendee's presence and providing a customized insight PDF/Text.
    """
    logger.info(f"--- GENERATING POST-PULSE RECAP FOR {attendee_name} ---")
    
    api_key = os.getenv("GEMINI_API_KEY_CONTENT") or os.getenv("GEMINI_API_KEY_ORCHESTRATOR")
    if not api_key:
        return "Error: API Key not configured for Content generation."

    system_instruction = f"""
    You are the Creative Content Agent for the event: '{event_title}'.
    Your objective is to write a highly personalized 'Post-Pulse' recap taking into account the event schedule and any recent changes (Pulse Events).
    Structure the response professionally but warmly, tailored specifically to '{attendee_name}'.
    Include 3 key takeaways or synthetic insights based on the event description and schedule.
    Do not output JSON, output a well-formatted markdown string.
    """
    
    user_prompt = f"""
    Event Title: {event_title}
    Event Details: {event_details}
    Master Schedule: {json.dumps(schedule[:5])} # Snippet of schedule
    Recent Drift/Pulse Events: {json.dumps(pulse_events)}
    Target Attendee: {attendee_name}
    """
    
    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-3.1-flash-lite-preview",
            contents=user_prompt,
            config={
                "system_instruction": system_instruction,
            }
        )
        return response.text
    except Exception as e:
        logger.error(f"Error generating recap: {str(e)}")
        return f"Failed to generate recap: {str(e)}"
