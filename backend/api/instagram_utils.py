import os
import requests
import time
import logging

logger = logging.getLogger(__name__)

GRAPH_API_URL = "https://graph.facebook.com/v19.0"

def get_config(account_id=None, access_token=None):
    return {
        "account_id": account_id or os.getenv("INSTAGRAM_BUSINESS_ACCOUNT_ID"),
        "access_token": access_token or os.getenv("INSTAGRAM_ACCESS_TOKEN")
    }

def create_media_container(image_url: str, caption: str, config: dict = None):
    """
    Step 1: Create a media container for an image.
    Returns the container ID.
    """
    if config is None:
        config = get_config()
        
    if not config.get("account_id") or not config.get("access_token"):
        raise Exception("Instagram API configuration missing. Provide it per-event or set INSTAGRAM_BUSINESS_ACCOUNT_ID in .env")

    url = f"{GRAPH_API_URL}/{config['account_id']}/media"
    payload = {
        "image_url": image_url,
        "caption": caption,
        "access_token": config["access_token"]
    }
    
    response = requests.post(url, data=payload)
    res_data = response.json()
    
    if "id" not in res_data:
        logger.error(f"Failed to create media container: {res_data}")
        raise Exception(f"Instagram Error: {res_data.get('error', {}).get('message', 'Unknown error')}")
    
    return res_data["id"]

def check_container_status(container_id: str, config: dict = None):
    """
    Step 2: Check the status of the media container.
    """
    if config is None:
        config = get_config()
    url = f"{GRAPH_API_URL}/{container_id}"
    params = {
        "fields": "status_code",
        "access_token": config["access_token"]
    }
    
    # Poll a few times
    for _ in range(10):
        response = requests.get(url, params=params)
        res_data = response.json()
        status = res_data.get("status_code")
        
        if status == "FINISHED":
            return True
        elif status == "ERROR":
            logger.error(f"Container processing error: {res_data}")
            return False
            
        time.sleep(2)
        
    return False

def publish_media(container_id: str, config: dict = None):
    """
    Step 3: Publish the media container.
    """
    if config is None:
        config = get_config()
    url = f"{GRAPH_API_URL}/{config['account_id']}/media_publish"
    payload = {
        "creation_id": container_id,
        "access_token": config["access_token"]
    }
    
    response = requests.post(url, data=payload)
    res_data = response.json()
    
    if "id" not in res_data:
        logger.error(f"Failed to publish media: {res_data}")
        raise Exception(f"Instagram Publish Error: {res_data.get('error', {}).get('message', 'Unknown error')}")
    
    return res_data["id"] # This is the actual post ID
