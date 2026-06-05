import asyncio
from sqlalchemy import text, inspect
from app.database import engine, init_db
from app.config.settings import get_settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_tables():
    settings = get_settings()
    logger.info(f"Initializing database...")
    
    try:
        await init_db()
        logger.info(f"✓ Database initialization successful")
        
        # Check if users table exists and has records
        async with engine.begin() as conn:
            result = await conn.execute(text("SELECT COUNT(*) FROM users"))
            count = result.scalar()
            logger.info(f"✓ Users table exists with {count} records")
            
            # List all tables
            result = await conn.execute(text("""
                SELECT tablename FROM pg_tables 
                WHERE schemaname = 'public' 
                ORDER BY tablename
            """))
            tables = result.fetchall()
            logger.info(f"✓ Database tables ({len(tables)}):")
            for table in tables:
                logger.info(f"  - {table[0]}")
        
        return True
    except Exception as e:
        logger.error(f"✗ Error: {e.__class__.__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    result = asyncio.run(test_tables())
    exit(0 if result else 1)
