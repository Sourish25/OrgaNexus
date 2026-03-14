from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from .state import EventState
from .content_strategist import content_strategist_node
from .scheduler import scheduler_node
from .communications import communications_node
from .logistics import logistics_node
from .asset_agent import visual_asset_node
from .media_agent import media_agent_node
from .roi_agent import roi_agent_node
import logging
import os
from google import genai
from langchain_core.messages import AIMessage

logger = logging.getLogger(__name__)

def build_orchestrator(interrupt_comms: bool = True):
    """
    Builds the LangGraph orchestrator to manage state and handoffs.
    Checks and pauses for human-in-the-loop if required.
    """
    workflow = StateGraph(EventState)
    
    # Add nodes
    workflow.add_node("content_strategist", content_strategist_node)
    workflow.add_node("scheduler", scheduler_node)
    workflow.add_node("communications", communications_node)
    workflow.add_node("logistics", logistics_node)
    workflow.add_node("visual_asset", visual_asset_node)
    workflow.add_node("media_agent", media_agent_node)
    workflow.add_node("roi_agent", roi_agent_node)
    
    def supervisor_node(state: EventState):
        logger.info("--- SUPERVISOR NODE ---")
        msgs = state.get("messages", [])
        if not msgs:
            return {"current_error": "No messages to process."}
            
        # If a sub-node requested a specific next agent (e.g. Scheduler pushing to Comms)
        if state.get("next_agent"):
            nxt = state.get("next_agent")
            if nxt == "communications_agent":
                return {"next_agent": "communications"}
        api_key = os.getenv("GEMINI_API_KEY_ROUTER")
        if not api_key:
            # Fallback router logic
            next_steps = []
            if state.get("event_details") and not state.get("social_media_posts"):
                next_steps.append("content_strategist")
            
            # Trigger scheduler if event_details are present, even without explicit constraints
            if state.get("event_details") and not state.get("master_schedule"):
                next_steps.append("scheduler")
                
            if (state.get("event_details") or len(state.get("registration_data", [])) > 0) and not state.get("logistics_plan"):
                next_steps.append("logistics")
            if (state.get("event_details") or len(state.get("registration_data", [])) > 0) and state.get("logistics_plan") and not state.get("roi_summary"):
                next_steps.append("roi_agent")
            if (state.get("event_details") or len(state.get("master_schedule", [])) > 0) and not state.get("press_release"):
                next_steps.append("media_agent")
            if (state.get("email_draft_base") or state.get("registration_data")) and not state.get("sent_emails"):
                next_steps.append("communications")
            if state.get("event_details") and not state.get("event_assets"):
                next_steps.append("visual_asset")
                
            if len(next_steps) > 0:
                return {"next_agent": next_steps[0]}
            return {"next_agent": END}

        client = genai.Client(api_key=api_key)
        
        system_instruction = """
        You are the Supervisor Agent for an Event Logistics Swarm.
        Review the current event state and decide which agent to run next.
        
        Available agents:
        - "content_strategist": Generates social media hype posts (requires 'event_details')
        - "scheduler": Resolves schedule and creates a master timeline (requires 'event_details' or 'scheduling_constraints')
        - "communications": Sends customized emails (requires 'email_draft_base' or 'registration_data')
        - "logistics": Creates budget, catering, and swag plans (requires 'event_details' or 'registration_data')
        - "visual_asset": Generates event posters and branding assets (requires 'event_details')
        - "media_agent": Generates an AP Style Press Release (requires 'registration_data' or 'master_schedule')
        - "roi_agent": Generates an Executive Summary and ROI (requires 'logistics_plan')
        - "END": Finish execution if all requested tasks are synthesized.
        """
        
        # Define the schema for structured output
        routing_schema = {
            "type": "OBJECT",
            "properties": {
                "next_agent": {
                    "type": "STRING", 
                    "enum": ["content_strategist", "scheduler", "communications", "logistics", "visual_asset", "media_agent", "roi_agent", "END"],
                    "description": "The name of the next agent to call or END"
                },
                "reasoning": {"type": "STRING", "description": "Brief explanation for choosing this agent"}
            },
            "required": ["next_agent", "reasoning"]
        }
        import json
        
        # 0. Generate Title if missing
        updates = {}
        current_title = state.get("event_title", "")
        if (not current_title or current_title == "Untitled Event") and state.get("event_details"):
            try:
                title_prompt = f"Based on these event details, yield a punchy, professional 3-4 word max title for this event. Do not use generic placeholders like 'Untitled'. Output ONLY the title text.\nDetails: {state['event_details']}"
                title_response = client.models.generate_content(
                    model="gemini-3.1-flash-lite-preview",
                    contents=title_prompt
                )
                if title_response.text:
                    new_title = title_response.text.strip().replace('"', '').replace("'", "")
                    # Update local state AND prepare for return
                    state["event_title"] = new_title
                    updates["event_title"] = new_title
                    
                    # Add a message to let the user know we auto-named it
                    evt_msg = AIMessage(content=f"Auto-generated event title: '{new_title}'", name="Supervisor")
                    if "messages" not in updates:
                        updates["messages"] = []
                    updates["messages"].append(evt_msg)
            except Exception as e:
                logger.error(f"Failed to auto-generate title: {str(e)}")
                updates["event_title"] = "Untitled Event"

        # 1. Check if we need to do anything
        user_prompt = f"""
        Current State:
        - Has event_details and no social posts: {bool(state.get('event_details') and not state.get('social_media_posts'))}
        - Needs schedule synthesis (has event_details and no master_schedule): {bool(state.get('event_details') and not state.get('master_schedule'))}
        - Needs logistics and budget: {bool((state.get('event_details') or len(state.get('registration_data', [])) > 0) and not state.get('logistics_plan'))}
        - Needs ROI and Summary: {bool((state.get('event_details') or len(state.get('registration_data', [])) > 0) and state.get('logistics_plan') and not state.get('roi_summary'))}
        - Needs professional visuals/posters: {bool(state.get('event_details') and not state.get('event_assets'))}
        - Needs AP Style Press Release: {bool((state.get('event_details') or len(state.get('master_schedule', [])) > 0) and not state.get('press_release'))}
        - Needs email personalization: {bool((state.get('email_draft_base') or len(state.get('registration_data', [])) > 0) and not state.get('sent_emails'))}
        """
        
        try:
            from google.genai import types
            response = client.models.generate_content(
                model="gemini-3.1-flash-lite-preview",
                contents=user_prompt,
                config={
                    "system_instruction": system_instruction,
                    "response_mime_type": "application/json",
                    "response_json_schema": routing_schema,
                    "thinking_config": types.ThinkingConfig(thinking_level="high")
                }
            )
            
            result = response.parsed
            logger.info(f"Supervisor Reasoning: {result.get('reasoning')}")
            
            # Map END to internal __end__
            nxt = result.get("next_agent")
            updates["next_agent"] = END if nxt == "END" else nxt
            return updates
                
        except Exception as e:
            logger.error(f"Router LLM failed: {str(e)}")
            updates["next_agent"] = END
            return updates

    workflow.add_node("supervisor", supervisor_node)
    
    workflow.set_entry_point("supervisor")
    
    workflow.add_conditional_edges(
        "supervisor",
        lambda state: state.get("next_agent") or END,
        {
            "content_strategist": "content_strategist",
            "scheduler": "scheduler",
            "communications": "communications",
            "logistics": "logistics",
            "visual_asset": "visual_asset",
            "media_agent": "media_agent",
            "roi_agent": "roi_agent",
            END: END
        }
    )
    
    workflow.add_edge("content_strategist", "supervisor")
    workflow.add_edge("scheduler", "supervisor")
    workflow.add_edge("communications", "supervisor")
    workflow.add_edge("logistics", "supervisor")
    workflow.add_edge("visual_asset", "supervisor")
    workflow.add_edge("media_agent", "supervisor")
    workflow.add_edge("roi_agent", "supervisor")
    
    # HITL: LangGraph Checkpointer
    memory = MemorySaver()
    app = workflow.compile(
        checkpointer=memory,
        interrupt_before=["communications"] if interrupt_comms else []
    )
    
    return app

# Singleton-ish instance for easy import
orchestrator_app = build_orchestrator()
