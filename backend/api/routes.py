from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
import uuid
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from agents.orchestrator import build_orchestrator
from langchain_core.messages import HumanMessage
from api.auth import get_current_user
from database import save_event, get_events_by_user, get_event_by_id, delete_event
import pandas as pd
import io

router = APIRouter()

from agents.orchestrator import build_orchestrator
from agents.recap_agent import generate_post_pulse_recap
orchestrator_app = build_orchestrator()

class SwarmRequest(BaseModel):
    event_details: Optional[str] = None
    scheduling_constraints: Optional[str] = None
    email_draft_base: Optional[str] = None
    human_approval_required: bool = False
    event_title: Optional[str] = "Untitled Event"
    instagram_business_account_id: Optional[str] = None
    instagram_access_token: Optional[str] = None
    twitter_bearer_token: Optional[str] = None
    linkedin_access_token: Optional[str] = None
    linkedin_person_urn: Optional[str] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None

class ApproveRequest(BaseModel):
    thread_id: str

class PulseRequest(BaseModel):
    drift_message: str

class RecapRequest(BaseModel):
    attendee_name: str

# =============================================================================
# SWARM EXECUTION (authenticated)
# =============================================================================

@router.post("/trigger")
async def trigger_swarm(request: SwarmRequest, current_user: dict = Depends(get_current_user)):
    """Trigger the Swarm without file uploads (Content Strategist or Scheduler focus)"""
    initial_state = {
        "messages": [HumanMessage(content="Start processing event logic.")],
        "event_details": request.event_details,
        "scheduling_constraints": request.scheduling_constraints,
        "email_draft_base": request.email_draft_base,
        "human_approval_required": request.human_approval_required,
    }
    
    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}
    
    try:
        # Re-build allowing dynamic pause disabling
        app = build_orchestrator(interrupt_comms=request.human_approval_required)
        final_state = app.invoke(initial_state, config=config)
        
        snapshot = app.get_state(config)
        is_paused = len(snapshot.next) > 0
        
        sent_emails = final_state.get("sent_emails") or []
        
        # Trigger real dispatch if it completed communications stage
        if not is_paused and sent_emails:
            from api.mail_utils import send_smtp_email
            config_params = {
                "smtp_user": request.smtp_user,
                "smtp_password": request.smtp_password
            } if request.smtp_user and request.smtp_password else None
            
            final_results = []
            for em in sent_emails:
                to_email = em.get("email")
                subject = em.get("personalized_subject")
                body = em.get("personalized_body")
                success = send_smtp_email(to_email, subject, body, config=config_params)
                em["smtp_sent"] = success
                final_results.append(em)
            final_state["sent_emails"] = final_results
        
        results = {
            "social_media_posts": final_state.get("social_media_posts"),
            "master_schedule": final_state.get("master_schedule"),
            "sent_emails": final_state.get("sent_emails"),
            "logistics_plan": final_state.get("logistics_plan"),
            "press_release": final_state.get("press_release"),
            "roi_summary": final_state.get("roi_summary"),
            "current_error": final_state.get("current_error"),
            "messages": [m.content for m in final_state.get("messages", [])]
        }
        
        # Save event persistently
        inputs = {
            "event_details": request.event_details,
            "scheduling_constraints": request.scheduling_constraints,
            "email_draft_base": request.email_draft_base,
            "instagram_config": {
                "account_id": request.instagram_business_account_id,
                "access_token": request.instagram_access_token
            } if request.instagram_business_account_id and request.instagram_access_token else None,
            "twitter_config": {
                "bearer_token": request.twitter_bearer_token
            } if request.twitter_bearer_token else None,
            "linkedin_config": {
                "access_token": request.linkedin_access_token,
                "person_urn": request.linkedin_person_urn
            } if request.linkedin_access_token and request.linkedin_person_urn else None,
            "smtp_config": {
                "smtp_user": request.smtp_user,
                "smtp_password": request.smtp_password
            } if request.smtp_user and request.smtp_password else None
        }
        final_title = final_state.get("event_title") or request.event_title or "Untitled Event"
        saved_event = save_event(current_user["id"], final_title, inputs, results)
        
        return {
            "status": "awaiting_approval" if is_paused else "completed",
            "thread_id": thread_id,
            "event_id": saved_event["id"],
            **results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload_and_trigger")
async def trigger_with_csv(
    event_details: str = Form(None),
    email_draft_base: str = Form(None),
    event_title: str = Form("Untitled Event"),
    human_approval_required: bool = Form(False),
    instagram_business_account_id: str = Form(None),
    instagram_access_token: str = Form(None),
    twitter_bearer_token: str = Form(None),
    linkedin_access_token: str = Form(None),
    linkedin_person_urn: str = Form(None),
    smtp_user: str = Form(None),
    smtp_password: str = Form(None),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Trigger the Communications Swarm with a CSV file"""
    contents = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(contents))
        df = df.fillna("")
        registration_data = df.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid CSV: {str(e)}")
        
    initial_state = {
        "messages": [HumanMessage(content="Start email communications processing.")],
        "event_details": event_details,
        "email_draft_base": email_draft_base,
        "registration_data": registration_data,
        "human_approval_required": human_approval_required,
        "instagram_config": {
            "account_id": instagram_business_account_id,
            "access_token": instagram_access_token
        } if instagram_business_account_id and instagram_access_token else None,
        "twitter_config": {
            "bearer_token": twitter_bearer_token
        } if twitter_bearer_token else None,
        "linkedin_config": {
            "access_token": linkedin_access_token,
            "person_urn": linkedin_person_urn
        } if linkedin_access_token and linkedin_person_urn else None,
        "smtp_config": {
            "smtp_user": smtp_user,
            "smtp_password": smtp_password
        } if smtp_user and smtp_password else None
    }
    
    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}
    
    try:
        app = build_orchestrator(interrupt_comms=human_approval_required)
        final_state = app.invoke(initial_state, config=config)
        
        snapshot = app.get_state(config)
        is_paused = len(snapshot.next) > 0
        
        sent_emails = final_state.get("sent_emails") or []
        if not is_paused and sent_emails:
            from api.mail_utils import send_smtp_email
            config_params = {
                "smtp_user": smtp_user,
                "smtp_password": smtp_password
            } if smtp_user and smtp_password else None
            
            final_results = []
            for em in sent_emails:
                to_email = em.get("email")
                subject = em.get("personalized_subject")
                body = em.get("personalized_body")
                success = send_smtp_email(to_email, subject, body, config=config_params)
                em["smtp_sent"] = success
                final_results.append(em)
            final_state["sent_emails"] = final_results
        
        results = {
            "sent_emails": final_state.get("sent_emails"),
            "logistics_plan": final_state.get("logistics_plan"),
            "social_media_posts": final_state.get("social_media_posts"),
            "master_schedule": final_state.get("master_schedule"),
            "press_release": final_state.get("press_release"),
            "roi_summary": final_state.get("roi_summary"),
            "current_error": final_state.get("current_error"),
            "messages": [m.content for m in final_state.get("messages", [])]
        }
        
        # Priority: State Title (AI) > Explicit Title > Default
        final_title = final_state.get("event_title") or event_title or "Untitled Event"
        
        inputs = {
            "event_details": event_details,
            "email_draft_base": email_draft_base,
            "registration_data": registration_data,
            "event_title": final_title, # Persist the title in inputs too
            "instagram_config": {
                "account_id": instagram_business_account_id,
                "access_token": instagram_access_token
            } if instagram_business_account_id and instagram_access_token else None,
            "twitter_config": {
                "bearer_token": twitter_bearer_token
            } if twitter_bearer_token else None,
            "linkedin_config": {
                "access_token": linkedin_access_token,
                "person_urn": linkedin_person_urn
            } if linkedin_access_token and linkedin_person_urn else None,
            "smtp_config": {
                "smtp_user": smtp_user,
                "smtp_password": smtp_password
            } if smtp_user and smtp_password else None
        }
        saved_event = save_event(current_user["id"], final_title, inputs, results)
        
        return {
            "status": "awaiting_approval" if is_paused else "completed",
            "thread_id": thread_id,
            "event_id": saved_event["id"],
            **results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/approve")
async def approve_swarm(request: ApproveRequest, current_user: dict = Depends(get_current_user)):
    config = {"configurable": {"thread_id": request.thread_id}}
    try:
        # Resume without pausing again so it flows to completion
        app = build_orchestrator(interrupt_comms=False)
        final_state = app.invoke(None, config=config)
        
        sent_emails = final_state.get("sent_emails") or []
        if sent_emails:
            from api.mail_utils import send_smtp_email
            
            # Fetch event model data safely to get smtp_config overrides
            # We don't want to rely solely on env here if they saved customs
            final_results = []
            try:
                # Approximate loader just in case
                from database import get_events_by_user # or grab by ID 
                # (Skip heavy DB queries if we can find state triggers, but iterate anyway with Env setups if none)
                pass
            except: pass
            
            for em in sent_emails:
                to_email = em.get("email")
                subject = em.get("personalized_subject")
                body = em.get("personalized_body")
                # For approval, fallback to environment or whatever was preset
                success = send_smtp_email(to_email, subject, body)
                em["smtp_sent"] = success
                final_results.append(em)
            final_state["sent_emails"] = final_results
        return {
            "status": "completed",
            "social_media_posts": final_state.get("social_media_posts"),
            "master_schedule": final_state.get("master_schedule"),
            "sent_emails": final_state.get("sent_emails"),
            "logistics_plan": final_state.get("logistics_plan"),
            "press_release": final_state.get("press_release"),
            "roi_summary": final_state.get("roi_summary"),
            "messages": [m.content for m in final_state.get("messages", [])]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# EVENT CRUD (authenticated)
# =============================================================================

@router.get("/events")
async def list_events(current_user: dict = Depends(get_current_user)):
    """Get all saved events for the current user."""
    events = get_events_by_user(current_user["id"])
    # Return lightweight summaries (no full results)
    return [
        {
            "id": e["id"],
            "title": e["title"],
            "created_at": e["created_at"],
            "has_social_posts": bool(e.get("results", {}).get("social_media_posts")),
            "has_schedule": bool(e.get("results", {}).get("master_schedule")),
            "has_emails": bool(e.get("results", {}).get("sent_emails")),
            "has_logistics": bool(e.get("results", {}).get("logistics_plan")),
            "has_press_release": bool(e.get("results", {}).get("press_release")),
            "has_roi_summary": bool(e.get("results", {}).get("roi_summary")),
        }
        for e in events
    ]

@router.get("/events/{event_id}")
async def get_event(event_id: str, current_user: dict = Depends(get_current_user)):
    """Get full details of a single event."""
    event = get_event_by_id(event_id, current_user["id"])
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event

@router.delete("/events/{event_id}")
async def remove_event(event_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a saved event."""
    success = delete_event(event_id, current_user["id"])
    if not success:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"status": "deleted"}

class UpdateConfigRequest(BaseModel):
    instagram_business_account_id: Optional[str] = None
    instagram_access_token: Optional[str] = None
    twitter_bearer_token: Optional[str] = None
    linkedin_access_token: Optional[str] = None
    linkedin_person_urn: Optional[str] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None

@router.put("/events/{event_id}/config")
async def update_event_config(event_id: str, request: UpdateConfigRequest, current_user: dict = Depends(get_current_user)):
    """Update social media and SMTP API credentials for an existing event."""
    from database import update_event
    event = get_event_by_id(event_id, current_user["id"])
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    inputs = event.get("inputs", {})
    
    if request.instagram_business_account_id or request.instagram_access_token:
        insta = inputs.get("instagram_config") or {}
        if request.instagram_business_account_id: insta["account_id"] = request.instagram_business_account_id
        if request.instagram_access_token: insta["access_token"] = request.instagram_access_token
        inputs["instagram_config"] = insta

    if request.twitter_bearer_token:
        twit = inputs.get("twitter_config") or {}
        twit["bearer_token"] = request.twitter_bearer_token
        inputs["twitter_config"] = twit

    if request.linkedin_access_token or request.linkedin_person_urn:
        linkd = inputs.get("linkedin_config") or {}
        if request.linkedin_access_token: linkd["access_token"] = request.linkedin_access_token
        if request.linkedin_person_urn: linkd["person_urn"] = request.linkedin_person_urn
        inputs["linkedin_config"] = linkd
        
    if request.smtp_user or request.smtp_password:
        smtp = inputs.get("smtp_config") or {}
        if request.smtp_user: smtp["smtp_user"] = request.smtp_user
        if request.smtp_password: smtp["smtp_password"] = request.smtp_password
        inputs["smtp_config"] = smtp
        
    update_event(event_id, current_user["id"], {"inputs": inputs})
    return {"status": "config_updated"}

# =============================================================================
# CONTEXTUAL PULSE (EVENT STATE DRIFT)
# =============================================================================

@router.post("/events/{event_id}/pulse")
async def inject_pulse(event_id: str, request: PulseRequest, current_user: dict = Depends(get_current_user)):
    """Webhook to simulate a real-time event drift / pulse."""
    event = get_event_by_id(event_id, current_user["id"])
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    inputs = event.get("inputs", {})
    results = event.get("results", {})
    pulse_events = results.get("pulse_events", [])
    pulse_events.append(request.drift_message)
    results["pulse_events"] = pulse_events
    
    # Trigger orchestrator to regenerate logistics and comms based on new drift
    initial_state = {
        "messages": [HumanMessage(content=f"PULSE DETECTED: {request.drift_message}")],
        "event_details": inputs.get("event_details"),
        "event_title": inputs.get("event_title", "Untitled Event"),
        "scheduling_constraints": inputs.get("scheduling_constraints"),
        "email_draft_base": inputs.get("email_draft_base"),
        "registration_data": inputs.get("registration_data", []),
        "pulse_events": pulse_events,
        "master_schedule": results.get("master_schedule", []),
        "logistics_plan": results.get("logistics_plan"),
        "human_approval_required": False
    }
    
    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}
    
    try:
        final_state = orchestrator_app.invoke(initial_state, config=config)
        
        # Merge updated plans back into results
        results["logistics_plan"] = final_state.get("logistics_plan")
        results["sent_emails"] = final_state.get("sent_emails")
        results["press_release"] = final_state.get("press_release")
        results["roi_summary"] = final_state.get("roi_summary")
        
        update_event(event_id, current_user["id"], {"results": results})
        
        return {
            "status": "pulse_processed",
            "logistics_plan": results["logistics_plan"],
            "sent_emails": results["sent_emails"],
            "press_release": results["press_release"],
            "roi_summary": results["roi_summary"],
            "pulse_events": pulse_events
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pulse processing failed: {str(e)}")

@router.post("/events/{event_id}/recap")
async def generate_recap(event_id: str, request: RecapRequest, current_user: dict = Depends(get_current_user)):
    """Generate a hyper-personalized post-event recap for a specific attendee."""
    event = get_event_by_id(event_id, current_user["id"])
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    results = event.get("results", {})
    inputs = event.get("inputs", {})
    
    recap = generate_post_pulse_recap(
        attendee_name=request.attendee_name,
        event_title=inputs.get("event_title", "Untitled Event"),
        event_details=inputs.get("event_details", ""),
        schedule=results.get("master_schedule", []),
        pulse_events=results.get("pulse_events", [])
    )
    
    # Store recap in DB
    post_pulse_recaps = results.get("post_pulse_recaps", {})
    post_pulse_recaps[request.attendee_name] = recap
    results["post_pulse_recaps"] = post_pulse_recaps
    update_event(event_id, current_user["id"], {"results": results})
    
    return {"recap": recap}
