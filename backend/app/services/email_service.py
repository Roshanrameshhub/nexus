"""Resend email integration — configure RESEND_API_KEY to enable."""

import logging

from app.config.settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def send_connection_accepted_email(to_email: str, name: str, accepter_name: str) -> bool:
    if not settings.RESEND_API_KEY:
        logger.warning("[EMAIL] RESEND_API_KEY not configured - connection accepted email not sent")
        return False
    try:
        import resend

        resend.api_key = settings.RESEND_API_KEY
        resend.Emails.send(
            {
                "from": settings.FROM_EMAIL,
                "to": [to_email],
                "subject": "Connection accepted on RConnectX",
                "html": f"<p>Hi {name}, {accepter_name} accepted your connection request on RConnectX.</p>",
            }
        )
        logger.info(f"[EMAIL] Connection accepted email sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"[EMAIL] Failed to send connection accepted email to {to_email}: {e}", exc_info=True)
        return False


async def send_password_reset_email(to_email: str, name: str, reset_url: str) -> bool:
    if not settings.RESEND_API_KEY:
        logger.warning("[EMAIL] RESEND_API_KEY not configured - password reset email not sent")
        return False
    try:
        import resend

        resend.api_key = settings.RESEND_API_KEY
        resend.Emails.send(
            {
                "from": settings.FROM_EMAIL,
                "to": [to_email],
                "subject": "Reset your RConnectX password",
                "html": (
                    f"<p>Hi {name},</p>"
                    f"<p>Click the link below to reset your password (valid for 1 hour):</p>"
                    f'<p><a href="{reset_url}">{reset_url}</a></p>'
                    f"<p>If you did not request this, ignore this email.</p>"
                ),
            }
        )
        logger.info(f"[EMAIL] Password reset email sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"[EMAIL] Failed to send password reset email to {to_email}: {e}", exc_info=True)
        return False


async def send_verification_email(to_email: str, name: str, verify_url: str) -> bool:
    if not settings.RESEND_API_KEY:
        logger.warning("[EMAIL] RESEND_API_KEY not configured - verification email not sent")
        return False
    try:
        import resend

        resend.api_key = settings.RESEND_API_KEY
        resend.Emails.send(
            {
                "from": settings.FROM_EMAIL,
                "to": [to_email],
                "subject": "Verify your RConnectX email",
                "html": (
                    f"<p>Hi {name},</p>"
                    f"<p>Thanks for signing up for RConnectX. Please verify your email address "
                    f"to activate your account (link valid for 24 hours):</p>"
                    f'<p><a href="{verify_url}">Verify my email</a></p>'
                    f"<p>Or copy this link: {verify_url}</p>"
                    f"<p>If you did not create an account, you can ignore this email.</p>"
                ),
            }
        )
        logger.info(f"[EMAIL] Verification email sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"[EMAIL] Failed to send verification email to {to_email}: {e}", exc_info=True)
        return False


async def send_welcome_email(to_email: str, name: str) -> bool:
    if not settings.RESEND_API_KEY:
        logger.warning("[EMAIL] RESEND_API_KEY not configured - welcome email not sent")
        return False
    try:
        import resend

        resend.api_key = settings.RESEND_API_KEY
        resend.Emails.send(
            {
                "from": settings.FROM_EMAIL,
                "to": [to_email],
                "subject": "Welcome to RConnectX",
                "html": f"<p>Hi {name}, welcome to the RConnectX startup ecosystem.</p>",
            }
        )
        logger.info(f"[EMAIL] Welcome email sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"[EMAIL] Failed to send welcome email to {to_email}: {e}", exc_info=True)
        return False
