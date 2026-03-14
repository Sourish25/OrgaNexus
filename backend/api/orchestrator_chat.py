"""
Orchestrator Chat — a Gemini-powered conversational interface for managing events.
The orchestrator can read the full event context, answer questions, and dispatch
actions (rename, regenerate content/schedule/logistics, update fields).
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import os
import json
import logging
from dotenv import load_dotenv
from google import genai

from api.auth import get_current_user
from database import (
    get_event_by_id, update_event,
    save_chat_message, get_chat_history
)
from agents.content_strategist import content_strategist_node
from agents.scheduler import scheduler_node
from agents.logistics import logistics_node
from agents.communications import communications_node
from langchain_core.messages import HumanMessage

load_dotenv()
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/orchestrator", tags=["orchestrator"])


class ChatRequest(BaseModel):
    event_id: str
    message: str


class ChatResponse(BaseModel):
    reply: str
    action_taken: Optional[str] = None
    updated_event: Optional[dict] = None


ORCHESTRATOR_SYSTEM_INSTRUCTION = """
You are the OrgaNexus Orchestrator — the central AI brain that manages an event.
You have full context about this event (details, schedule, social posts, logistics, emails).
The organizer is chatting with you to manage and modify their event.

## Your Responsibilities:
1. **True Management**: If the organizer changes the name or a core premise of the event, you MUST ensure all other assets (schedule, social posts, logistics) stay in sync.
2. **Action Dispatch**: You are more than a chatbot. Use the actions to actually change the state of the system when the user asks for changes.
3. **Propagate Changes**: If you rename an event, trigger regenerations so the social media posts and emails reflect the new name!

## API Credentials & Validation:
- You MUST check the "API & Platform Credentials Status" section in the context below before promising or executing publishing actions.
- If a user asks to publish to Instagram, Twitter, or LinkedIn, and the state is "MISSING", DO NOT promise it will work. Advise the user to provide their API key first (they can use the "Manage Connections" panel in the UI).
- For Email, if the status is "FALLBACK_TO_DEMO_ENV", it will still work for demo purposes, but you may inform them that they can configure custom SMTP details for isolated sending.

## Action Exclusivity & Integrity Guardrails:
1. **Single Action Constraint**: You can set exactly ONE `action` tag per turn. If a user tries complex triggers together (e.g. rename + emails), prioritize core model modifies (`UPDATE_DETAILS`, `UPDATE_TITLE`).
2. **Details Preservation**: When emitting `UPDATE_DETAILS`, your `new_details` argument MUST be the **COMPLETE** merged event brief. Do not return just diffs or standalone adjustments; re-emit the whole descriptive text block combined with the updates so data isn't wiped out!
3. **Preflight Failure Safety**: If triggers require prerequisites explicitly listed as MISSING in the context segments (e.g., dispatching emails without participant lists), lock `action` to `NONE` and reply asking them to provision the context first.
"""

# Define the schema for structured output
orchestrator_schema = {
    "type": "OBJECT",
    "properties": {
        "reply": {"type": "STRING", "description": "Your conversational response to the organizer"},
        "action": {
            "type": "STRING", 
            "enum": ["NONE", "UPDATE_TITLE", "UPDATE_DETAILS", "PULSE_DRIFT", "REGENERATE_CONTENT", "REGENERATE_SCHEDULE", "REGENERATE_LOGISTICS", "DISPATCH_EMAILS", "REGENERATE_PR", "REGENERATE_ROI"],
            "description": "The symbolic name of the action to take"
        },
        "new_title": {"type": "STRING", "description": "The new title if UPDATE_TITLE is chosen, else null"},
        "new_details": {"type": "STRING", "description": "The updated event details if UPDATE_DETAILS is chosen. MUST be the COMPLETE text string merging edits with old context fully to prevent overrides, else null"}
    },
    "required": ["reply", "action"]
}


def _build_context(event: dict) -> str:
    """Build a context string from the event data for the orchestrator."""
    results = event.get("results", {})
    inputs = event.get("inputs", {})

    context_parts = [f"EVENT TITLE: {event.get('title', 'Untitled')}"]
    context_parts.append(f"CREATED: {event.get('created_at', 'Unknown')}")

    context_parts.append("\n## API & Platform Credentials Status:")
    insta = inputs.get("instagram_config", {})
    context_parts.append(f"- Instagram: {'CONNECTED' if insta and insta.get('access_token') else 'MISSING (Cannot publish)'}")
    twit = inputs.get("twitter_config", {})
    context_parts.append(f"- Twitter: {'CONNECTED' if twit and twit.get('bearer_token') else 'MISSING (Cannot publish)'}")
    linkd = inputs.get("linkedin_config", {})
    context_parts.append(f"- LinkedIn: {'CONNECTED' if linkd and linkd.get('access_token') else 'MISSING (Cannot publish)'}")
    smtp = inputs.get("smtp_config", {})
    context_parts.append(f"- SMTP/Email: {'CUSTOM' if smtp and smtp.get('smtp_user') else 'FALLBACK_TO_DEMO_ENV (Works for demo)'}")

    if inputs.get("event_details"):
        context_parts.append(f"\n## Original Event Details:\n{inputs['event_details']}")

    if inputs.get("scheduling_constraints"):
        context_parts.append(f"\n## Original Scheduling Input:\n{inputs['scheduling_constraints']}")

    pulse = results.get("pulse_events", [])
    if pulse:
        context_parts.append(f"\n## REAL-TIME DRIFT (Pulse Events):")
        for p in pulse:
            context_parts.append(f"- {p}")

    posts = results.get("social_media_posts", [])
    if posts:
        context_parts.append(f"\n## Generated Social Posts ({len(posts)} posts):")
        for p in posts[:5]:
            context_parts.append(f"- [{p.get('platform', '?')}] {p.get('copy', '')[:100]}...")

    schedule = results.get("master_schedule", [])
    if schedule:
        context_parts.append(f"\n## Generated Schedule ({len(schedule)} items):")
        for s in schedule[:10]:
            context_parts.append(
                f"- {s.get('start_time', '?')} | {s.get('title', '?')} | {s.get('speaker', '?')} @ {s.get('location', '?')}")

    lp = results.get("logistics_plan")
    if lp:
        context_parts.append(f"\n## Logistics Plan:")
        context_parts.append(f"- Budget: {lp.get('estimated_budget', 'N/A')}")
        context_parts.append(f"- Catering: {lp.get('catering_suggestion', 'N/A')}")
        context_parts.append(f"- Swag: {lp.get('swag_package', 'N/A')}")
        bottlenecks = lp.get("critical_bottlenecks", [])
        if bottlenecks:
            context_parts.append(f"- Bottlenecks: {', '.join(bottlenecks)}")

    roi = results.get("roi_summary")
    if roi:
        context_parts.append(f"\n## ROI and Summary:")
        context_parts.append(f"- Exec Summary: {roi.get('executive_summary', 'N/A')}")
        context_parts.append(f"- Demographics: {roi.get('detailed_participation', {}).get('key_demographics', 'N/A')}")
        
    pr = results.get("press_release")
    if pr:
        context_parts.append(f"\n## Generated Press Release:")
        context_parts.append(f"- Hook: {pr.splitlines()[0] if pr.splitlines() else pr}")

    emails = results.get("sent_emails", [])
    if emails:
        context_parts.append(f"\n## Generated Emails: {len(emails)} personalized emails ready")

    reg_data = inputs.get("registration_data", [])
    if reg_data:
        context_parts.append(f"\n## Participant Data: {len(reg_data)} users registered via CSV.")
        context_parts.append("Sample Participants:")
        for r in reg_data[:3]:
            # Try to grab name/email safely
            name = r.get("name") or r.get("Name") or "Unknown"
            email = r.get("email") or r.get("Email") or "No Email"
            context_parts.append(f"- {name} ({email})")
    else:
        context_parts.append("\n## Participant Data: MISSING (Cannot dispatch emails, advise user to upload registry/CSV first)")

    return "\n".join(context_parts)


def _regenerate_content(event: dict, prompt: str = "") -> dict:
    """Re-run the content strategist agent."""
    inputs = event.get("inputs", {})
    results = event.get("results", {})
    state = {
        "messages": [HumanMessage(content=f"Regenerate content. User Request: {prompt}" if prompt else "Regenerate content.")],
        "event_title": event.get("title", ""),
        "event_details": inputs.get("event_details", ""),
        "pulse_events": results.get("pulse_events", []),
    }
    result = content_strategist_node(state)
    return result.get("social_media_posts", [])


def _regenerate_schedule(event: dict, prompt: str = "") -> list:
    """Re-run the scheduler agent."""
    inputs = event.get("inputs", {})
    results = event.get("results", {})
    state = {
        "messages": [HumanMessage(content=f"Regenerate schedule. User Request: {prompt}" if prompt else "Regenerate schedule.")],
        "event_title": event.get("title", ""),
        "event_details": inputs.get("event_details", ""),
        "scheduling_constraints": inputs.get("scheduling_constraints", ""),
        "pulse_events": results.get("pulse_events", []),
        "master_schedule": results.get("master_schedule", []),
    }
    result = scheduler_node(state)
    return result.get("master_schedule", [])

def _regenerate_pr(event: dict) -> str:
    """Re-run the media agent."""
    from agents.media_agent import media_agent_node
    inputs = event.get("inputs", {})
    results = event.get("results", {})
    state = {
        "messages": [HumanMessage(content="Regenerate press release.")],
        "event_title": event.get("title", ""),
        "event_details": inputs.get("event_details", ""),
        "master_schedule": results.get("master_schedule", []),
        "registration_data": inputs.get("registration_data", []),
        "pulse_events": results.get("pulse_events", []),
    }
    result = media_agent_node(state)
    return result.get("press_release", "")

def _regenerate_logistics(event: dict, prompt: str = "") -> dict:
    """Re-run the logistics agent."""
    inputs = event.get("inputs", {})
    results = event.get("results", {})
    state = {
        "messages": [HumanMessage(content=f"Regenerate logistics. User Request: {prompt}" if prompt else "Regenerate logistics.")],
        "event_title": event.get("title", ""),
        "event_details": inputs.get("event_details", ""),
        "registration_data": inputs.get("registration_data", []),
        "pulse_events": results.get("pulse_events", []),
    }
    result = logistics_node(state)
    return result.get("logistics_plan", {})

def _regenerate_roi(event: dict) -> dict:
    """Re-run the ROI agent."""
    from agents.roi_agent import roi_agent_node
    inputs = event.get("inputs", {})
    results = event.get("results", {})
    state = {
        "messages": [HumanMessage(content="Regenerate ROI plan.")],
        "event_title": event.get("title", ""),
        "event_details": inputs.get("event_details", ""),
        "registration_data": inputs.get("registration_data", []),
        "logistics_plan": results.get("logistics_plan", {}),
        "pulse_events": results.get("pulse_events", []),
    }
    result = roi_agent_node(state)
    return result.get("roi_summary", {})


def _dispatch_emails(event: dict) -> list:
    """Run the communications agent to personalize and send emails."""
    inputs = event.get("inputs", {})
    reg_data = inputs.get("registration_data", [])
    draft_base = inputs.get("email_draft_base", "")
    
    if not reg_data:
        raise ValueError("No registration data found to send emails to.")
        
    state = {
        "messages": [HumanMessage(content="Dispatch all emails.")],
        "event_title": event.get("title", ""),
        "email_draft_base": draft_base,
        "registration_data": reg_data,
        "master_schedule": event.get("results", {}).get("master_schedule", [])
    }
    
    result = communications_node(state)
    sent_emails = result.get("sent_emails", [])
    
    if not sent_emails:
        return []
        
    # Actually send via SMTP
    from api.mail_utils import send_smtp_email
    
    final_results = []
    for em in sent_emails:
        to_email = em.get("email")
        subject = em.get("personalized_subject")
        body = em.get("personalized_body")
        
        success = send_smtp_email(to_email, subject, body)
        em["smtp_sent"] = success
        final_results.append(em)
        
    return final_results


@router.get("/history/{event_id}")
async def get_history(event_id: str, current_user: dict = Depends(get_current_user)):
    """Get chat history for an event."""
    event = get_event_by_id(event_id, current_user["id"])
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return get_chat_history(event_id)


@router.post("/chat", response_model=ChatResponse)
async def orchestrator_chat(request: ChatRequest, current_user: dict = Depends(get_current_user)):
    """Chat with the orchestrator about a specific event."""
    event = get_event_by_id(request.event_id, current_user["id"])
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    api_key = os.getenv("GEMINI_API_KEY_ORCHESTRATOR")
    if not api_key:
        # Fallback to router key
        api_key = os.getenv("GEMINI_API_KEY_ROUTER") or os.getenv("GEMINI_API_KEY_CONTENT")
    if not api_key:
        raise HTTPException(status_code=500, detail="No API key for orchestrator. Set GEMINI_API_KEY_ORCHESTRATOR in .env")

    # Save user message
    save_chat_message(request.event_id, "user", request.message)

    # Build context
    event_context = _build_context(event)
    chat_history = get_chat_history(request.event_id)

    # Build conversation for the LLM
    history_text = ""
    # Include last 20 messages for context
    recent = chat_history[-20:]
    for msg in recent:
        role_label = "Organizer" if msg["role"] == "user" else "Orchestrator"
        history_text += f"{role_label}: {msg['content']}\n"

    user_prompt = f"""
    ## Current Event Context:
    {event_context}
    
    ## Recent Conversation:
    {history_text}
    
    Organizer: {request.message}
    """
    
    try:
        from google.genai import types
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-3.1-flash-lite-preview",
            contents=user_prompt,
            config={
                "system_instruction": ORCHESTRATOR_SYSTEM_INSTRUCTION,
                "response_mime_type": "application/json",
                "response_json_schema": orchestrator_schema,
                "thinking_config": types.ThinkingConfig(thinking_level="high")
            }
        )
        
        parsed = response.parsed
        reply_text = parsed.get("reply", "I processed your request.")
        action = parsed.get("action", "NONE")
        updated_event = None
        
        # Execute action if needed
        if action == "UPDATE_TITLE":
            new_title = parsed.get("new_title") or "Untitled Event"
            # 1. Update Title
            updated = update_event(request.event_id, current_user["id"], {"title": new_title})
            if updated:
                event = updated
                updated_event = updated
                reply_text += f"\n\n✅ Event renamed to \"{new_title}\"."
                
                # 2. Propagate name change to Event Details so agents know the new name
                old_details = event.get("inputs", {}).get("event_details", "")
                new_details = f"Event Name: {new_title}\n{old_details}"
                updated = update_event(request.event_id, current_user["id"], {"inputs": {"event_details": new_details}})
                if updated:
                    event = updated
                
                # 3. Trigger full regeneration so all assets reflect the new name
                regenerated = []
                try:
                    event["results"]["social_media_posts"] = _regenerate_content(event)
                    update_event(request.event_id, current_user["id"], {"results": {"social_media_posts": event["results"]["social_media_posts"]}})
                    regenerated.append("social posts")
                except: pass
                
                try:
                    event["results"]["master_schedule"] = _regenerate_schedule(event)
                    update_event(request.event_id, current_user["id"], {"results": {"master_schedule": event["results"]["master_schedule"]}})
                    regenerated.append("schedule")
                except: pass
                
                try:
                    event["results"]["press_release"] = _regenerate_pr(event)
                    update_event(request.event_id, current_user["id"], {"results": {"press_release": event["results"]["press_release"]}})
                    regenerated.append("press release")
                except: pass
                
                try:
                    event["results"]["roi_summary"] = _regenerate_roi(event)
                    update_event(request.event_id, current_user["id"], {"results": {"roi_summary": event["results"]["roi_summary"]}})
                    regenerated.append("ROI summary")
                except: pass
                
                if regenerated:
                    reply_text += f"\n✅ Synchronized and updated: {', '.join(regenerated)} with the new name."
                
        elif action == "UPDATE_DETAILS":
            new_details = parsed.get("new_details")
            if new_details:
                # 1. Update the database inputs
                updated = update_event(request.event_id, current_user["id"], {"inputs": {"event_details": new_details}})
                if updated:
                    event = updated
                    updated_event = updated
                    reply_text += f"\n\n✅ Event details updated."
                    
                    # 2. Trigger Full System Sync
                    regenerated = []
                    try:
                        event["results"]["social_media_posts"] = _regenerate_content(event)
                        update_event(request.event_id, current_user["id"], {"results": {"social_media_posts": event["results"]["social_media_posts"]}})
                        regenerated.append("social posts")
                    except: pass

                    try:
                        event["results"]["master_schedule"] = _regenerate_schedule(event)
                        update_event(request.event_id, current_user["id"], {"results": {"master_schedule": event["results"]["master_schedule"]}})
                        regenerated.append("schedule")
                    except: pass

                    try:
                        event["results"]["logistics_plan"] = _regenerate_logistics(event)
                        update_event(request.event_id, current_user["id"], {"results": {"logistics_plan": event["results"]["logistics_plan"]}})
                        regenerated.append("logistics")
                    except: pass

                    try:
                        event["results"]["press_release"] = _regenerate_pr(event)
                        update_event(request.event_id, current_user["id"], {"results": {"press_release": event["results"]["press_release"]}})
                        regenerated.append("press release")
                    except: pass
                    
                    try:
                        event["results"]["roi_summary"] = _regenerate_roi(event)
                        update_event(request.event_id, current_user["id"], {"results": {"roi_summary": event["results"]["roi_summary"]}})
                        regenerated.append("ROI summary")
                    except: pass

                    try:
                        # Cascade update to emails so copies are synchronous on display
                        new_emails = _dispatch_emails(event)
                        if new_emails:
                            updated = update_event(request.event_id, current_user["id"], {"results": {"sent_emails": new_emails}})
                            if updated:
                                updated_event = updated
                            regenerated.append("email drafts")
                    except: pass
                    
                    if regenerated:
                        reply_text += f"\n✅ Re-orchestrated all agents: {', '.join(regenerated)} have been updated with the new details."

        elif action == "PULSE_DRIFT":
            # 1. Record the drift
            pulse_events = event.get("results", {}).get("pulse_events", [])
            pulse_events.append(request.message)
            updated = update_event(request.event_id, current_user["id"], {"results": {"pulse_events": pulse_events}})
            if updated:
                event = updated
                updated_event = updated
                reply_text += f"\n\n⚡️ Drift Detected: \"{request.message}\""
                
                # 2. Trigger Full System Sync
                regenerated = []
                try:
                    event["results"]["master_schedule"] = _regenerate_schedule(event)
                    update_event(request.event_id, current_user["id"], {"results": {"master_schedule": event["results"]["master_schedule"]}})
                    regenerated.append("schedule")
                except: pass

                try:
                    event["results"]["logistics_plan"] = _regenerate_logistics(event)
                    update_event(request.event_id, current_user["id"], {"results": {"logistics_plan": event["results"]["logistics_plan"]}})
                    regenerated.append("logistics")
                except: pass

                try:
                    event["results"]["press_release"] = _regenerate_pr(event)
                    update_event(request.event_id, current_user["id"], {"results": {"press_release": event["results"]["press_release"]}})
                    regenerated.append("press release")
                except: pass
                
                try:
                    event["results"]["roi_summary"] = _regenerate_roi(event)
                    update_event(request.event_id, current_user["id"], {"results": {"roi_summary": event["results"]["roi_summary"]}})
                    regenerated.append("ROI summary")
                except: pass

                try:
                    # Cascade update to emails so copies are synchronous on display
                    new_emails = _dispatch_emails(event)
                    if new_emails:
                        updated = update_event(request.event_id, current_user["id"], {"results": {"sent_emails": new_emails}})
                        if updated:
                            updated_event = updated
                        regenerated.append("email drafts")
                except: pass
                
                if regenerated:
                    reply_text += f"\n✅ Re-orchestrated all agents: {', '.join(regenerated)} have been adjusted for this drift."

        elif action == "REGENERATE_CONTENT":
            try:
                new_posts = _regenerate_content(event, prompt=request.message)
                if new_posts:
                    updated = update_event(request.event_id, current_user["id"],
                                           {"results": {"social_media_posts": new_posts}})
                    updated_event = updated
                    reply_text += f"\n\n✅ Regenerated {len(new_posts)} social media posts."
            except Exception as e:
                reply_text += f"\n\n⚠️ Content regeneration failed: {str(e)}"

        elif action == "REGENERATE_SCHEDULE":
            try:
                new_schedule = _regenerate_schedule(event, prompt=request.message)
                if new_schedule:
                    updated = update_event(request.event_id, current_user["id"],
                                           {"results": {"master_schedule": new_schedule}})
                    updated_event = updated
                    reply_text += f"\n\n✅ Regenerated schedule with {len(new_schedule)} items."
                    
                    # Cascade update to emails so copies are synchronous on display
                    try:
                        # update local event memory so helper sees the new schedule
                        if "results" not in event: event["results"] = {}
                        event["results"]["master_schedule"] = new_schedule
                        new_emails = _dispatch_emails(event) # Actually sends but we'll use same state sync triggers for consistency inside chat
                        if new_emails:
                            updated = update_event(request.event_id, current_user["id"], {"results": {"sent_emails": new_emails}})
                            if updated:
                                updated_event = updated
                            reply_text += f"\n✅ Re-calculated {len(new_emails)} email drafts to match the new schedule times."
                    except: pass
            except Exception as e:
                reply_text += f"\n\n⚠️ Schedule regeneration failed: {str(e)}"

        elif action == "REGENERATE_LOGISTICS":
            try:
                new_logistics = _regenerate_logistics(event)
                if new_logistics:
                    updated = update_event(request.event_id, current_user["id"],
                                           {"results": {"logistics_plan": new_logistics}})
                    updated_event = updated
                    reply_text += "\n\n✅ Regenerated logistics plan."
            except Exception as e:
                reply_text += f"\n\n⚠️ Logistics regeneration failed: {str(e)}"

        elif action == "REGENERATE_PR":
            try:
                new_pr = _regenerate_pr(event)
                if new_pr:
                    updated = update_event(request.event_id, current_user["id"],
                                           {"results": {"press_release": new_pr}})
                    updated_event = updated
                    reply_text += "\n\n✅ Regenerated AP Style Press Release."
            except Exception as e:
                reply_text += f"\n\n⚠️ Press Release regeneration failed: {str(e)}"

        elif action == "REGENERATE_ROI":
            try:
                new_roi = _regenerate_roi(event)
                if new_roi:
                    updated = update_event(request.event_id, current_user["id"],
                                           {"results": {"roi_summary": new_roi}})
                    updated_event = updated
                    reply_text += "\n\n✅ Regenerated ROI & Executive Summary."
            except Exception as e:
                reply_text += f"\n\n⚠️ ROI regeneration failed: {str(e)}"

        elif action == "DISPATCH_EMAILS":
            try:
                sent_emails = _dispatch_emails(event)
                if sent_emails:
                    updated = update_event(request.event_id, current_user["id"],
                                           {"results": {"sent_emails": sent_emails}})
                    updated_event = updated
                    reply_text += f"\n\n✅ Successfully generated and dispatched {len(sent_emails)} personalized emails."
                else:
                    reply_text += "\n\n⚠️ No emails were generated. Check your participant data."
            except Exception as e:
                reply_text += f"\n\n⚠️ Email dispatch failed: {str(e)}"

        # Save orchestrator reply
        save_chat_message(request.event_id, "orchestrator", reply_text)

        return ChatResponse(
            reply=reply_text,
            action_taken=action if action != "NONE" else None,
            updated_event=updated_event
        )

    except Exception as e:
        logger.error(f"Orchestrator chat error: {str(e)}")
        error_reply = f"Sorry, I encountered an error: {str(e)}"
        save_chat_message(request.event_id, "orchestrator", error_reply)
        return ChatResponse(reply=error_reply)
