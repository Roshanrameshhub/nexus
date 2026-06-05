"""Resend email integration — configure RESEND_API_KEY to enable."""

from app.config.settings import get_settings

settings = get_settings()


async def send_connection_accepted_email(to_email: str, name: str, accepter_name: str) -> bool:
    if not settings.RESEND_API_KEY:
        return False
    try:
        import resend

        resend.api_key = settings.RESEND_API_KEY
        resend.Emails.send(
            {
                "from": settings.FROM_EMAIL,
                "to": [to_email],
                "subject": "Connection accepted on Nexus",
                "html": f"<p>Hi {name}, {accepter_name} accepted your connection request on Nexus.</p>",
            }
        )
        return True
    except Exception:
        return False


async def send_password_reset_email(to_email: str, name: str, reset_url: str) -> bool:
    if not settings.RESEND_API_KEY:
        return False
    try:
        import resend

        resend.api_key = settings.RESEND_API_KEY
        resend.Emails.send(
            {
                "from": settings.FROM_EMAIL,
                "to": [to_email],
                "subject": "Reset your Nexus password",
                "html": (
                    f"<p>Hi {name},</p>"
                    f"<p>Click the link below to reset your password (valid for 1 hour):</p>"
                    f'<p><a href="{reset_url}">{reset_url}</a></p>'
                    f"<p>If you did not request this, ignore this email.</p>"
                ),
            }
        )
        return True
    except Exception:
        return False


async def send_welcome_email(to_email: str, name: str) -> bool:
    if not settings.RESEND_API_KEY:
        return False
    try:
        import resend

        resend.api_key = settings.RESEND_API_KEY
        resend.Emails.send(
            {
                "from": settings.FROM_EMAIL,
                "to": [to_email],
                "subject": "Welcome to Nexus",
                "html": f"<p>Hi {name}, welcome to the Nexus startup ecosystem.</p>",
            }
        )
        return True
    except Exception:
        return False
