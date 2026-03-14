import os
import requests
import logging

logger = logging.getLogger(__name__)

def post_to_linkedin(text: str, image_url: str = None, config: dict = None) -> str:
    """
    Publish a post to LinkedIn (User Share).
    Returns the Activity URN (Post ID) on success.
    """
    access_token = config.get("access_token") if config else os.getenv("LINKEDIN_ACCESS_TOKEN")
    person_urn = config.get("person_urn") if config else os.getenv("LINKEDIN_PERSON_URN")
    
    if not access_token or not person_urn:
        raise Exception("LinkedIn API configuration missing. Provide it per-event or set LINKEDIN_ACCESS_TOKEN and LINKEDIN_PERSON_URN in .env")

    # LinkedIn UGC Posts API
    url = "https://api.linkedin.com/v2/ugcPosts"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0"
    }
    
    payload = {
        "author": person_urn,
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": {
                    "text": text
                },
                "shareMediaCategory": "NONE" if not image_url else "IMAGE"
                # For images, LinkedIn requires registering media first, uploading, then referencing URN.
                # Simplifying for demo/simulation unless full upload flow requested.
            }
        },
        "visibility": {
            "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
        }
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        res_data = response.json()
        
        if response.status_code == 201:
            return response.headers.get("X-RestLi-Id", "urn:node:unknown")
        else:
            logger.error(f"LinkedIn API Error: {res_data}")
            raise Exception(f"LinkedIn Error: {res_data.get('message', 'Unknown error')}")
            
    except Exception as e:
        logger.error(f"LinkedIn post failed: {str(e)}")
        raise e
