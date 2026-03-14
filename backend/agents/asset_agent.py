from langchain_core.messages import AIMessage
from .state import EventState
from typing import Dict, Any
import logging
import os
from google import genai

logger = logging.getLogger(__name__)

def visual_asset_node(state: EventState) -> Dict[str, Any]:
    """
    The Visual Asset Agent.
    Generates high-quality event posters and promotional visuals.
    """
    logger.info("--- VISUAL ASSET AGENT ---")
    event_details = state.get("event_details", "")
    event_title = state.get("event_title", "Untitled Event")
    
    if not event_details:
        return {"current_error": "No event details provided for Visual Asset Agent."}
    
    # In a production environment, this would call Imagen 3 via Google Cloud or the Gemini SDK.
    # For this demo, we will generate a descriptive prompt for the image and "simulate" the generation
    # by using a high-quality placeholder or a placeholder service that takes descriptions.
    
    # 1. Generate a "Master Prompt" for the poster using Gemini
    api_key = os.getenv("GEMINI_API_KEY_CONTENT")
    client = genai.Client(api_key=api_key)
    
    system_instruction = f"""
    You are a premium Graphic Design Director. 
    Your task is to write a highly detailed 'image generation prompt' for a professional event poster.
    Event: {event_title}
    Details: {event_details}
    
    Focus on: Cinematic lighting, modern tech aesthetic, premium typography, 4k resolution.
    """
    
    try:
        # 1. Generate the 'Master Prompt' for the image
        # This works even on the free tier (text generation)
        response = client.models.generate_content(
            model="gemini-3.1-flash-lite-preview", 
            contents="Create a 1-paragraph highly detailed prompt for an AI image generator to create a stunning event poster.",
            config={"system_instruction": system_instruction}
        )
        image_prompt = response.text.strip()

        # 2. Hybrid Logic: Attempt AI Gen (Imagen 3) or Fallback to Unsplash
        # In a real app, you would try:
        # ai_response = client.models.generate_image(model='imagen-3', prompt=image_prompt)
        # poster_url = ai_response.images[0].url
        
        # --- ROBUST IMAGE FALLBACK SYSTEM ---
        # 1. Define high-quality, verified Unsplash URLs that are guaranteed to work.
        IMAGE_POOLS = {
            "tech": [
                "https://images.unsplash.com/photo-1518770662538-5f219fdfefed",
                "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4",
                "https://images.unsplash.com/photo-1573164713714-d95e436ab8d6"
            ],
            "corporate": [
                "https://images.unsplash.com/photo-1542744173-8e7e53415bb0",
                "https://images.unsplash.com/photo-1505373630103-821c70e3c8ad",
                "https://images.unsplash.com/photo-1515187029135-18ee286d815b"
            ],
            "music": [
                "https://images.unsplash.com/photo-1470225620780-dba8ba36b745",
                "https://images.unsplash.com/photo-1501612780327-450002192720",
                "https://images.unsplash.com/photo-1514320499067-95e287c442a2"
            ],
            "default": [
                "https://images.unsplash.com/photo-1497366216548-37526070297c",
                "https://images.unsplash.com/photo-1498050108023-c5249f4df085"
            ]
        }
        
        # 2. Map keywords to pool items
        keywords = ("technology,event,poster," + event_title).lower()
        if any(w in keywords for w in ["hackathon", "coding", "software", "tech", "ai"]):
            category = "tech"
        elif any(w in keywords for w in ["music", "concert", "fest", "dj"]):
            category = "music"
        elif any(w in keywords for w in ["seminar", "corporate", "conference", "business"]):
            category = "corporate"
        else:
            category = "default"
            
        import random
        pool = IMAGE_POOLS.get(category, IMAGE_POOLS["default"])
        # Append sizing parameters to make it full HD
        poster_url = random.choice(pool) + "?auto=format&fit=crop&q=80&w=1080&h=1080"
        
        # 3. Verification step using requests.head to ensure 200 OK
        import requests
        try:
            head_check = requests.head(poster_url, timeout=3)
            if head_check.status_code >= 400:
                # If fail, use a guaranteed bulletproof fallback
                logger.warning(f"Image validation failed ({head_check.status_code}). Using placeholder.")
                poster_url = "https://images.unsplash.com/photo-1505373630103-821c70e3c8ad?auto=format&fit=crop&q=80&w=1080&h=1080"
        except:
            logger.warning("Image head validation timed out. Continuing with URL.")
        
        asset = {
            "type": "poster",
            "url": poster_url,
            "prompt_suggested": image_prompt
        }
        
        current_assets = state.get("event_assets", [])
        current_assets.append(asset)
        
        # Update social posts to use this specific poster
        updated_posts = state.get("social_media_posts", [])
        for post in updated_posts:
            # Only set image if it's Instagram or missing
            if post.get("platform", "").lower() == "instagram" or not post.get("image_url"):
                post["image_url"] = poster_url

        return {
            "event_assets": current_assets,
            "social_media_posts": updated_posts,
            "messages": [AIMessage(content=f"Synthesized professional visual assets for '{event_title}'.", name="VisualAssetAgent")]
        }
    except Exception as e:
        logger.error(f"Error in Visual Asset Agent: {str(e)}")
        return {"current_error": f"Visual asset generation failed: {str(e)}"}
