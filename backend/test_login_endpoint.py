import asyncio
from app.routes.auth import login
from app.schemas.auth import LoginRequest, TokenResponse
from app.database import AsyncSessionLocal
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_login_endpoint():
    logger.info("Testing login endpoint...")
    
    try:
        db = AsyncSessionLocal()
        
        # Test with a real user email
        login_request = LoginRequest(
            email="user@example.com",
            password="password123"
        )
        
        logger.info(f"Attempting login with email: {login_request.email}")
        
        response = await login(login_request, db)
        
        logger.info(f"✓ Login successful!")
        logger.info(f"  Access Token: {response.access_token[:20]}...")
        logger.info(f"  User: {response.user.email} ({response.user.role})")
        
        await db.close()
        return True
        
    except Exception as e:
        logger.error(f"✗ Login failed: {e.__class__.__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    result = asyncio.run(test_login_endpoint())
    exit(0 if result else 1)
