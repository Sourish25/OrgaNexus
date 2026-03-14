from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from api.auth import get_current_user
from database import get_event_by_id, save_event, update_event
from api.instagram_utils import create_media_container, check_container_status, publish_media
from api.twitter_utils import post_to_twitter
from api.linkedin_utils import post_to_linkedin
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/social", tags=["social"])

class ConnectSocialRequest(BaseModel):
    event_id: str
    post_index: int  # Index of the post in social_media_posts list

@router.post("/publish-instagram")
async def publish_to_instagram(req: ConnectSocialRequest, current_user: dict = Depends(get_current_user)):
    """Publish a generated social media post to Instagram."""
    event = get_event_by_id(req.event_id, current_user["id"])
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    posts = event.get("results", {}).get("social_media_posts", [])
    if not posts or req.post_index >= len(posts):
        raise HTTPException(status_code=400, detail="Invalid post index")
    
    post = posts[req.post_index]
    image_url = post.get("image_url")
    if not image_url:
        raise HTTPException(status_code=400, detail="Post must have an image_url to publish to Instagram")

    try:
        insta_config = event.get("inputs", {}).get("instagram_config")
        container_id = create_media_container(image_url, post.get("copy", ""), config=insta_config)
        
        if not check_container_status(container_id, config=insta_config):
            raise HTTPException(status_code=500, detail="Instagram processing timed out or failed")
        
        post_id = publish_media(container_id, config=insta_config)
        
        post["published"] = True
        post["published_platform"] = "Instagram"
        post["instagram_post_id"] = post_id
        
        update_event(req.event_id, current_user["id"], {"results": event["results"]})
        return {"status": "success", "instagram_post_id": post_id}

    except Exception as e:
        logger.error(f"Instagram publishing failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/publish-twitter")
async def publish_to_twitter(req: ConnectSocialRequest, current_user: dict = Depends(get_current_user)):
    """Publish a generated social media post to Twitter."""
    event = get_event_by_id(req.event_id, current_user["id"])
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    posts = event.get("results", {}).get("social_media_posts", [])
    if not posts or req.post_index >= len(posts):
        raise HTTPException(status_code=400, detail="Invalid post index")
    
    post = posts[req.post_index]
    
    try:
        twit_config = event.get("inputs", {}).get("twitter_config")
        post_id = post_to_twitter(post.get("copy", ""), post.get("image_url"), config=twit_config)
        
        post["published"] = True
        post["published_platform"] = "Twitter"
        post["twitter_post_id"] = post_id
        
        update_event(req.event_id, current_user["id"], {"results": event["results"]})
        return {"status": "success", "twitter_post_id": post_id}
        
    except Exception as e:
        logger.error(f"Twitter publishing failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/publish-linkedin")
async def publish_to_linkedin(req: ConnectSocialRequest, current_user: dict = Depends(get_current_user)):
    """Publish a generated social media post to LinkedIn."""
    event = get_event_by_id(req.event_id, current_user["id"])
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    posts = event.get("results", {}).get("social_media_posts", [])
    if not posts or req.post_index >= len(posts):
        raise HTTPException(status_code=400, detail="Invalid post index")
    
    post = posts[req.post_index]
    
    try:
        linkd_config = event.get("inputs", {}).get("linkedin_config")
        post_id = post_to_linkedin(post.get("copy", ""), post.get("image_url"), config=linkd_config)
        
        post["published"] = True
        post["published_platform"] = "LinkedIn"
        post["linkedin_post_id"] = post_id
        
        update_event(req.event_id, current_user["id"], {"results": event["results"]})
        return {"status": "success", "linkedin_post_id": post_id}
        
    except Exception as e:
        logger.error(f"LinkedIn publishing failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
