from typing import TypedDict, List, Dict, Any, Optional
from langchain_core.messages import BaseMessage

class EventState(TypedDict):
    """
    Main state for the Event Logistics Swarm LangGraph.
    """
    # Messages in the current conversation/execution
    messages: List[BaseMessage]
    
    # Event Context
    event_title: str
    event_details: str
    
    # Assets & Outputs
    social_media_posts: List[Dict[str, Any]]
    event_assets: List[Dict[str, str]] # [{ "type": "poster", "url": "..." }]
    
    # Communications
    email_draft_base: str
    registration_data: List[Dict[str, Any]]
    sent_emails: List[Dict[str, Any]]
    
    # Scheduling
    scheduling_constraints: str
    master_schedule: List[Dict[str, Any]]
    
    # Logistics
    logistics_plan: Optional[Dict[str, Any]]

    # Media/Summary
    press_release: Optional[str]
    roi_summary: Optional[Dict[str, Any]]

    # Event State Drift
    pulse_events: Optional[List[str]]
    post_pulse_recaps: Optional[Dict[str, str]]

    # Control signals
    next_agent: Optional[str]
    human_approval_required: bool
    modelType: Optional[str]
    current_error: Optional[str]
