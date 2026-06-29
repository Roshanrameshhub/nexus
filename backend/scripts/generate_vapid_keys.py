#!/usr/bin/env python3
"""Generate VAPID key pair for Web Push. Run from backend/."""

import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def main() -> None:
    private_key = ec.generate_private_key(ec.SECP256R1())
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("ascii")

    public_bytes = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint,
    )
    public_key = _b64url(public_bytes)

    print("Add these to Render (backend service environment):")
    print()
    print(f"VAPID_PUBLIC_KEY={public_key}")
    print()
    print("VAPID_PRIVATE_KEY=" + private_pem.replace("\n", "\\n"))
    print()
    print("VAPID_CLAIMS_EMAIL=mailto:admin@yourdomain.com")
    print()
    print("Also set FRONTEND_URL to your production site (notification click URLs).")


if __name__ == "__main__":
    main()
