from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin_console import AdminAuditLog


async def log_admin_action(
    db: AsyncSession,
    actor_id: UUID | None,
    action: str,
    target_type: str | None = None,
    target_id: str | None = None,
    details: str | None = None,
) -> None:
    db.add(
        AdminAuditLog(
            actor_id=actor_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            details=details,
        )
    )
