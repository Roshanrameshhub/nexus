import asyncio
from sqlalchemy import text
from app.database import engine
from app.config.settings import get_settings
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

async def test_connection():
    settings = get_settings()
    logger.info(f"Testing database connection...")
    logger.info(f"DATABASE_URL: {settings.DATABASE_URL}")
    
    try:
        async with engine.begin() as conn:
            result = await conn.execute(text("SELECT 1"))
            row = result.fetchone()
            logger.info(f"✓ Database connection successful! Result: {row}")
            return True
    except Exception as e:
        logger.error(f"✗ Database connection failed: {e.__class__.__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    result = asyncio.run(test_connection())
    exit(0 if result else 1)
