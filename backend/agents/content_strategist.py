from langchain_core.messages import AIMessage
from .state import EventState
from typing import Dict, Any
import json
import logging
import os
from dotenv import load_dotenv
from google import genai

load_dotenv()
logger = logging.getLogger(__name__)

def content_strategist_node(state: EventState) -> Dict[str, Any]:
    """
    The Content Strategist & Social Media Agent.
    Generates promotional copy, suggests posts, and recommends release times.
    """
    logger.info("--- CONTENT STRATEGIST AGENT ---")
    event_details = state.get("event_details") or ""
    event_title = state.get("event_title") or "Untitled Event"
    
    if not event_details:
        return {"current_error": "No event details provided for Content Strategist."}
        
    api_key = os.getenv("GEMINI_API_KEY_CONTENT")
    if not api_key:
        return {"current_error": "GEMINI_API_KEY_CONTENT not configured in .env."}

    system_instruction = f"""
    You are the Content Strategist & Social Media Expert for the event: '{event_title}'.
    Based on the event details provided, generate 3 promotional social media posts to build hype.
    Analyze best practices to recommend optimal release times.
    """
    
    # Define the schema for structured output
    posts_schema = {
        "type": "ARRAY",
        "items": {
            "type": "OBJECT",
            "properties": {
                "platform": {"type": "STRING", "description": "The social media platform (e.g., Twitter, LinkedIn, Instagram)"},
                "copy": {"type": "STRING", "description": "The text of the post content"},
                "release_time": {"type": "STRING", "description": "The recommended release time (e.g., Day 1, 9:00 AM)"},
                "image_url": {"type": "STRING", "description": "A placeholder image URL suitable for the platform (use highly relevant Unsplash URLs if possible)"}
            },
            "required": ["platform", "copy", "release_time", "image_url"]
        }
    }
    
    user_prompt = f"Event Title: {event_title}\nDescription: {event_details}"
    
    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-3.1-flash-lite-preview",
            contents=user_prompt,
            config={
                "system_instruction": system_instruction,
                "response_mime_type": "application/json",
                "response_json_schema": posts_schema,
            }
        )
        
        posts = response.parsed
        
        return {
            "social_media_posts": posts,
            "messages": [AIMessage(content=f"Synthesized {len(posts)} social posts for '{event_title}'.", name="ContentStrategist")]
        }
    except Exception as e:
        logger.error(f"Error in Content Strategist: {str(e)}")
        return {"current_error": f"Content strategist failed: {str(e)}"}
