import smtplib
import os
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

def send_smtp_email(to_email: str, subject: str, body: str, config: dict = None) -> bool:
    """
    Sends an email using SMTP credentials from the provided config or .env file.
    Returns True on success, False otherwise.
    """
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = os.getenv("SMTP_PORT")
    smtp_user = config.get("smtp_user") if config and config.get("smtp_user") else os.getenv("SMTP_USER")
    smtp_pass = config.get("smtp_password") if config and config.get("smtp_password") else os.getenv("SMTP_PASSWORD")

    if not all([smtp_host, smtp_port, smtp_user, smtp_pass]):
        logger.warning(f"SMTP not configured. Email to {to_email} will be logged but not sent.")
        logger.info(f"PREVIEW: [{subject}] to {to_email}\nBody: {body[:100]}...")
        return False

    try:
        # Create message
        msg = MIMEMultipart()
        msg['From'] = smtp_user
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))

        # Connect and send
        with smtplib.SMTP(smtp_host, int(smtp_port)) as server:
            server.starttls()  # Secure the connection
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
            
        logger.info(f"Successfully sent email to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        return False

def test_smtp_connection(config: dict = None) -> tuple[bool, str]:
    """
    Tests the SMTP connection and credentials.
    Returns (success: bool, message: str)
    """
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = os.getenv("SMTP_PORT")
    smtp_user = config.get("smtp_user") if config and config.get("smtp_user") else os.getenv("SMTP_USER")
    smtp_pass = config.get("smtp_password") if config and config.get("smtp_password") else os.getenv("SMTP_PASSWORD")

    if not all([smtp_host, smtp_port, smtp_user, smtp_pass]):
        return False, "SMTP credentials missing in .env"

    try:
        with smtplib.SMTP(smtp_host, int(smtp_port), timeout=10) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
        return True, "SMTP connection successful!"
    except Exception as e:
        return False, f"SMTP connection failed: {str(e)}"
