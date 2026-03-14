"""
JSON-file-based storage for users and events.
Data is persisted in the `data/` directory as JSON files.
"""
import json
import os
import uuid
from datetime import datetime
from pathlib import Path
import hashlib
import secrets

# --- Password Hashing (hashlib-based, no length limits) ---

def _hash_password(password: str) -> str:
    """Hash a password with a random salt using SHA256."""
    salt = secrets.token_hex(16)
    hashed = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}${hashed}"

def _verify_password(password: str, stored_hash: str) -> bool:
    """Verify a password against a stored hash."""
    salt, hashed = stored_hash.split("$", 1)
    return hashlib.sha256((salt + password).encode()).hexdigest() == hashed

# --- Paths ---
DATA_DIR = Path(__file__).parent / "data"
USERS_FILE = DATA_DIR / "users.json"
EVENTS_FILE = DATA_DIR / "events.json"
REMINDERS_FILE = DATA_DIR / "reminders.json"
SCHEDULED_EMAILS_FILE = DATA_DIR / "scheduled_emails.json"
CHAT_HISTORY_FILE = DATA_DIR / "chat_history.json"

def _ensure_data_dir():
    """Create the data directory and initial files if they don't exist."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    for filepath in [USERS_FILE, EVENTS_FILE, REMINDERS_FILE, SCHEDULED_EMAILS_FILE, CHAT_HISTORY_FILE]:
        if not filepath.exists():
            filepath.write_text("[]", encoding="utf-8")

_ensure_data_dir()

# --- Generic Helpers ---

def _read_json(filepath: Path) -> list:
    try:
        return json.loads(filepath.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, FileNotFoundError):
        return []

def _write_json(filepath: Path, data: list):
    filepath.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")

# =============================================================================
# USERS
# =============================================================================

def create_user(name: str, email: str, password: str) -> dict:
    """Register a new organizer user. Returns the user dict (without password)."""
    users = _read_json(USERS_FILE)
    
    # Check if email already exists
    if any(u["email"].lower() == email.lower() for u in users):
        raise ValueError("A user with this email already exists.")
    
    user = {
        "id": str(uuid.uuid4()),
        "name": name,
        "email": email.lower(),
        "password_hash": _hash_password(password),
        "created_at": datetime.utcnow().isoformat(),
    }
    users.append(user)
    _write_json(USERS_FILE, users)
    
    # Return without password_hash
    return {k: v for k, v in user.items() if k != "password_hash"}

def authenticate_user(email: str, password: str) -> dict | None:
    """Verify email + password. Returns user dict (without hash) or None."""
    users = _read_json(USERS_FILE)
    for u in users:
        if u["email"].lower() == email.lower():
            if _verify_password(password, u["password_hash"]):
                return {k: v for k, v in u.items() if k != "password_hash"}
    return None

def get_user_by_id(user_id: str) -> dict | None:
    """Look up a user by their ID."""
    users = _read_json(USERS_FILE)
    for u in users:
        if u["id"] == user_id:
            return {k: v for k, v in u.items() if k != "password_hash"}
    return None

# =============================================================================
# EVENTS (Swarm Executions)
# =============================================================================

def save_event(user_id: str, title: str, inputs: dict, results: dict) -> dict:
    """Save a swarm execution result as a persistent event."""
    events = _read_json(EVENTS_FILE)
    
    event = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": title or "Untitled Event",
        "inputs": inputs,
        "results": results,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    events.append(event)
    _write_json(EVENTS_FILE, events)
    return event

def get_events_by_user(user_id: str) -> list:
    """Get all events belonging to a specific user."""
    events = _read_json(EVENTS_FILE)
    return [e for e in events if e["user_id"] == user_id]

def get_event_by_id(event_id: str, user_id: str) -> dict | None:
    """Get a single event by its ID, scoped to the user."""
    events = _read_json(EVENTS_FILE)
    for e in events:
        if e["id"] == event_id and e["user_id"] == user_id:
            return e
    return None

def delete_event(event_id: str, user_id: str) -> bool:
    """Delete an event. Returns True if found and deleted."""
    events = _read_json(EVENTS_FILE)
    filtered = [e for e in events if not (e["id"] == event_id and e["user_id"] == user_id)]
    if len(filtered) == len(events):
        return False
    _write_json(EVENTS_FILE, filtered)
    return True

def update_event(event_id: str, user_id: str, updates: dict) -> dict | None:
    """Partially update a saved event. Returns the updated event or None."""
    events = _read_json(EVENTS_FILE)
    for e in events:
        if e["id"] == event_id and e["user_id"] == user_id:
            # Merge updates into top-level fields
            if "title" in updates:
                e["title"] = updates["title"]
            if "inputs" in updates:
                e["inputs"] = {**e.get("inputs", {}), **updates["inputs"]}
            if "results" in updates:
                e["results"] = {**e.get("results", {}), **updates["results"]}
            e["updated_at"] = datetime.utcnow().isoformat()
            _write_json(EVENTS_FILE, events)
            return e
    return None

# =============================================================================
# REMINDERS
# =============================================================================

def save_reminder(user_id: str, event_id: str, message: str, scheduled_time: str, smtp_config: dict = None) -> dict:
    """Create a new reminder for an event."""
    reminders = _read_json(REMINDERS_FILE)
    reminder = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "event_id": event_id,
        "message": message,
        "scheduled_time": scheduled_time,
        "sent": False,
        "smtp_config": smtp_config,  # Custom SMTP config for this reminder
        "created_at": datetime.utcnow().isoformat(),
    }
    reminders.append(reminder)
    _write_json(REMINDERS_FILE, reminders)
    return reminder

def get_reminders_by_event(event_id: str, user_id: str) -> list:
    """Get all reminders for a specific event."""
    reminders = _read_json(REMINDERS_FILE)
    return [r for r in reminders if r["event_id"] == event_id and r["user_id"] == user_id]

def delete_reminder(reminder_id: str, user_id: str) -> bool:
    """Delete a reminder."""
    reminders = _read_json(REMINDERS_FILE)
    filtered = [r for r in reminders if not (r["id"] == reminder_id and r["user_id"] == user_id)]
    if len(filtered) == len(reminders):
        return False
    _write_json(REMINDERS_FILE, filtered)
    return True

# =============================================================================
# SCHEDULED EMAILS
# =============================================================================

def save_scheduled_email(user_id: str, event_id: str, subject: str, body: str, 
                         recipients_csv_path: str, send_time: str, smtp_config: dict = None) -> dict:
    """Schedule an email blast."""
    emails = _read_json(SCHEDULED_EMAILS_FILE)
    email_entry = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "event_id": event_id,
        "subject": subject,
        "body": body,
        "recipients_csv_path": recipients_csv_path,
        "send_time": send_time,
        "status": "scheduled",
        "smtp_config": smtp_config,  # Custom SMTP config for this blast
        "created_at": datetime.utcnow().isoformat(),
    }
    emails.append(email_entry)
    _write_json(SCHEDULED_EMAILS_FILE, emails)
    return email_entry

def get_scheduled_emails(user_id: str) -> list:
    """Get all scheduled emails for a user."""
    emails = _read_json(SCHEDULED_EMAILS_FILE)
    return [e for e in emails if e["user_id"] == user_id]

def delete_scheduled_email(email_id: str, user_id: str) -> bool:
    """Delete a scheduled email."""
    emails = _read_json(SCHEDULED_EMAILS_FILE)
    filtered = [e for e in emails if not (e["id"] == email_id and e["user_id"] == user_id)]
    if len(filtered) == len(emails):
        return False
    _write_json(SCHEDULED_EMAILS_FILE, filtered)
    return True

# =============================================================================
# CHAT HISTORY (Orchestrator conversations per event)
# =============================================================================

def save_chat_message(event_id: str, role: str, content: str) -> dict:
    """Save a chat message for an event's orchestrator conversation."""
    history = _read_json(CHAT_HISTORY_FILE)
    msg = {
        "id": str(uuid.uuid4()),
        "event_id": event_id,
        "role": role,  # 'user' or 'orchestrator'
        "content": content,
        "timestamp": datetime.utcnow().isoformat(),
    }
    history.append(msg)
    _write_json(CHAT_HISTORY_FILE, history)
    return msg

def get_all_scheduled_emails() -> list:
    """Get all scheduled emails across all users (for background worker)."""
    return _read_json(SCHEDULED_EMAILS_FILE)

def mark_email_as_sent(email_id: str) -> bool:
    """Mark a scheduled email as sent."""
    emails = _read_json(SCHEDULED_EMAILS_FILE)
    for e in emails:
        if e["id"] == email_id:
            e["status"] = "sent"
            e["sent_at"] = datetime.utcnow().isoformat()
            _write_json(SCHEDULED_EMAILS_FILE, emails)
            return True
    return False

def get_chat_history(event_id: str) -> list:
    """Get all chat messages for a specific event."""
    history = _read_json(CHAT_HISTORY_FILE)
    return [m for m in history if m["event_id"] == event_id]
