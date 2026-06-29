import asyncio
from app.database import AsyncSessionLocal
from app.models.user import User
from app.core.security import get_password_hash

async def create_admin():
    async with AsyncSessionLocal() as db:
        # Check if admin already exists
        from sqlalchemy import select
        result = await db.execute(select(User).where(User.email == "admin.nexusnetwork@gmail.com"))
        existing = result.scalar_one_or_none()
        
        if existing:
            print("⚠️ Admin already exists! Updating...")
            existing.hashed_password = get_password_hash("nexus152822")
            existing.is_verified = True
            existing.is_email_verified = True
        else:
            admin = User(
                email="admin.nexusnetwork@gmail.com",
                username="admin",
                name="Admin",
                hashed_password=get_password_hash("nexus152822"),
                role="founder",  # ✅ Use a valid enum value
                platform_role="SUPER_ADMIN",
                is_verified=True,
                is_email_verified=True
            )
            db.add(admin)
        
        await db.commit()
        print("✅ Admin created/updated successfully!")
        print("📧 Email: admin.nexusnetwork@gmail.com")
        print("🔑 Password: nexus152822")

if __name__ == "__main__":
    asyncio.run(create_admin())