"""Verify deleting a post cascades to reposts without NotNullViolation."""
from __future__ import annotations

import asyncio
import sys
import uuid
from pathlib import Path

from sqlalchemy import func, select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import AsyncSessionLocal
from app.models.bookmark import Repost
from app.models.post import Post, PostType
from app.models.user import User


async def main() -> int:
    async with AsyncSessionLocal() as db:
        user_result = await db.execute(select(User).limit(1))
        user = user_result.scalar_one_or_none()
        if not user:
            print("SKIP: no users in database")
            return 0

        post = Post(user_id=user.id, content="delete cascade test", post_type=PostType.text)
        db.add(post)
        await db.flush()

        for i in range(3):
            db.add(Repost(original_post_id=post.id, user_id=user.id, caption=f"repost {i}"))

        await db.flush()
        post_id = post.id

        repost_count = (
            await db.execute(select(func.count()).select_from(Repost).where(Repost.original_post_id == post_id))
        ).scalar()
        assert repost_count == 3, f"expected 3 reposts, got {repost_count}"

        await db.delete(post)
        await db.commit()

        remaining_reposts = (
            await db.execute(select(func.count()).select_from(Repost).where(Repost.original_post_id == post_id))
        ).scalar()
        remaining_post = (
            await db.execute(select(Post).where(Post.id == post_id))
        ).scalar_one_or_none()

        if remaining_post is not None:
            print("FAIL: post still exists")
            return 1
        if remaining_reposts != 0:
            print(f"FAIL: {remaining_reposts} reposts still exist")
            return 1

        print("OK: post and reposts deleted without integrity errors")
        return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
