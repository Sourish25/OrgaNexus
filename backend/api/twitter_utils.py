import os
import requests
import logging

logger = logging.getLogger(__name__)

def post_to_twitter(text: str, image_url: str = None, config: dict = None) -> str:
    """
    Publish a post to Twitter.
    Returns the Tweet ID on success.
    """
    bearer_token = config.get("bearer_token") if config else os.getenv("TWITTER_BEARER_TOKEN")
    
    if not bearer_token:
        raise Exception("Twitter API configuration missing. Provide it per-event or set TWITTER_BEARER_TOKEN in .env")

    # real API V2 implementation (Simple Text + Image if possible)
    url = "https://api.twitter.com/2/tweets"
    headers = {
        "Authorization": f"Bearer {bearer_token}",
        "Content-Type": "application/json"
    }
    payload = {"text": text}
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        res_data = response.json()
        
        if response.status_code == 201 and "data" in res_data:
            return res_data["data"]["id"]
        else:
            logger.error(f"Twitter API Error: {res_data}")
            raise Exception(f"Twitter Error: {res_data.get('detail', 'Unknown error')}")
            
    except Exception as e:
        logger.error(f"Twitter post failed: {str(e)}")
        raise e
