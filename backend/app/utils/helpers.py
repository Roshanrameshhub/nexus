import re
import uuid


def generate_username(email: str, name: str) -> str:
    base = re.sub(r"[^a-z0-9]", "", (name or email.split("@")[0]).lower())[:20]
    return f"{base}_{uuid.uuid4().hex[:6]}"
