import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
import pandas as pd
from api.mail_utils import send_smtp_email
from database import get_all_scheduled_emails, mark_email_as_sent

logger = logging.getLogger(__name__)

# Use absolute path relative to project root
PROJECT_ROOT = Path(__file__).parent.parent
SCHEDULED_EMAILS_PATH = PROJECT_ROOT / "data" / "scheduled_emails.json"

async def email_worker():
    """
    Background worker that checks for due emails every 60 seconds.
    """
    logger.info("Starting Email Background Worker...")
    
    while True:
        try:
            now = datetime.now(timezone.utc)
            # Fetch all scheduled emails directly from DB/JSON abstraction
            all_emails = get_all_scheduled_emails()
            
            pending = [e for e in all_emails if e.get("status") == "scheduled"]
            
            for entry in pending:
                from database import get_event_by_id
                event = get_event_by_id(entry.get("event_id"), entry.get("user_id"))
                
                # Fetch custom SMTP config from the entry itself OR fall back to event credentials
                smtp_config = entry.get("smtp_config")
                if not smtp_config and event:
                    smtp_config = event.get("inputs", {}).get("smtp_config")
                
                send_time_str = entry.get("send_time")
                if not send_time_str:
                    continue
                
                try:
                    send_time = datetime.fromisoformat(send_time_str)
                    # Handle naive datetimes by assuming UTC
                    if send_time.tzinfo is None:
                        send_time = send_time.replace(tzinfo=timezone.utc)
                except ValueError:
                    logger.error(f"Invalid send_time format for email {entry['id']}")
                    continue
                
                if now >= send_time:
                    logger.info(f"Processing due email: {entry['subject']} (ID: {entry['id']})")
                    
                    recipients_path = entry.get("recipients_csv_path")
                    if not recipients_path:
                        logger.error(f"No recipients path for email {entry['id']}")
                        continue
                        
                    # Build absolute path if it is relative
                    if not os.path.isabs(recipients_path):
                        recipients_path = PROJECT_ROOT / recipients_path

                    if not os.path.exists(recipients_path):
                        logger.error(f"Recipients file not found at {recipients_path}")
                        continue
                    
                    try:
                        df = pd.read_csv(recipients_path)
                        # Find email column
                        email_col = next((c for c in df.columns if "email" in c.lower()), None)
                        
                        if not email_col:
                            logger.error("No 'email' column found in CSV")
                            continue
                        
                        recipients = df[email_col].dropna().unique().tolist()
                        
                        # Send emails
                        success_count = 0
                        for email_addr in recipients:
                            if send_smtp_email(email_addr, entry['subject'], entry['body'], config=smtp_config):
                                success_count += 1
                        
                        # Mark as sent in DB
                        mark_email_as_sent(entry['id'])
                        logger.info(f"Broadcast complete for {entry['id']}: {success_count}/{len(recipients)} sent.")
                        
                    except Exception as e:
                        logger.error(f"Error processing recipient list: {str(e)}")
                        
        except Exception as e:
            logger.error(f"Error in background email worker: {str(e)}")
            
        # Wait 1 minute
        await asyncio.sleep(60)
