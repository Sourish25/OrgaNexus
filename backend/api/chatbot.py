"""
Helpdesk Chatbot — a separate Gemini-powered Q&A endpoint for participants.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import os
import logging
from dotenv import load_dotenv
from google import genai

load_dotenv()
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chatbot"])

class ChatRequest(BaseModel):
    message: str
    event_context: Optional[str] = None  # Optional event details for context

class ChatResponse(BaseModel):
    reply: str

@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Chat with the helpdesk AI assistant."""
    api_key = os.getenv("GEMINI_API_KEY_CONTENT")  # Reuse content key
    if not api_key:
        api_key = os.getenv("GEMINI_API_KEY_ROUTER") or os.getenv("GEMINI_API_KEY_COMMS")
    
    if not api_key:
        raise HTTPException(status_code=500, detail="No Gemini API key configured. Set GEMINI_API_KEY_CONTENT in .env")

    system_instruction = """
    You are the OrgaNexus Helpdesk Assistant — a friendly, knowledgeable AI assistant for event participants.
    
    Your responsibilities:
    - Answer questions about event schedules, logistics, venues, and general event information
    - Help participants navigate the event (where to go, what to expect)
    - Provide information about speakers, sessions, and tracks
    - Answer general questions about the event platform
    
    Rules:
    - Be concise and helpful
    - If event context is provided, use it to give specific answers
    - If you don't know something specific, say so honestly
    - Keep responses under 200 words unless more detail is needed
    - Be friendly and professional
    """

    user_prompt = f"Participant Question: {request.message}"
    if request.event_context:
        user_prompt = f"Event Context: {request.event_context}\n\n{user_prompt}"

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-3.1-flash-lite-preview",
            contents=user_prompt,
            config={
                "system_instruction": system_instruction,
            }
        )
        return ChatResponse(reply=response.text.strip())
    except Exception as e:
        logger.error(f"Chatbot error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Chatbot error: {str(e)}")
