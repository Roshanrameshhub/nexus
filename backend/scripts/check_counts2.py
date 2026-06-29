import sys
sys.path.insert(0, r"c:\Users\rosha\Downloads\NEXUS\backend")
import asyncio
from sqlalchemy import text
from app.database import engine

async def run():
    async with engine.connect() as conn:
        for table in ("users","posts","messages"):
            try:
                res = await conn.execute(text(f"SELECT count(*) FROM {table}"))
                row = res.fetchone()
                print(f"{table}: {row[0] if row else 'unknown'}")
            except Exception as e:
                print(f"ERROR counting {table}: {e.__class__.__name__}: {e}")
        # sample users
        try:
            res = await conn.execute(text("SELECT id, email, username FROM users LIMIT 5"))
            rows = res.fetchall()
            print('\nSample users:')
            for r in rows:
                print(r)
        except Exception as e:
            print(f"ERROR sampling users: {e}")

if __name__ == '__main__':
    asyncio.run(run())
