import asyncio
import json
from app.database import AsyncSessionLocal
from app.models.user import User
from app.core.security import get_password_hash, verify_password
from sqlalchemy import select
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_login_flow():
    logger.info("Starting login flow test...")
    
    try:
        # Get a session
        async with AsyncSessionLocal() as db:
            # Query a user
            logger.info("Querying for test user...")
            result = await db.execute(select(User).where(User.email == "test@example.com"))
            user = result.scalar_one_or_none()
            
            if user:
                logger.info(f"✓ Found user: {user.email} (ID: {user.id})")
                logger.info(f"  Has hashed password: {user.hashed_password is not None}")
                
                # Test password verification
                if user.hashed_password:
                    is_valid = verify_password("password123", user.hashed_password)
                    logger.info(f"  Password verification result: {is_valid}")
                else:
                    logger.warning("  User has no hashed password!")
            else:
                logger.warning("✗ No user found with email 'test@example.com'")
                
                # List all users
                logger.info("Available users in database:")
                result = await db.execute(select(User).limit(5))
                users = result.scalars().all()
                for u in users:
                    logger.info(f"  - {u.email} (ID: {u.id})")
            
            return True
            
    except Exception as e:
        logger.error(f"✗ Error: {e.__class__.__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    result = asyncio.run(test_login_flow())
    exit(0 if result else 1)
