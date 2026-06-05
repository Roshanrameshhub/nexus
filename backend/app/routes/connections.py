from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies.auth import CurrentUser
from app.models.connection import Connection, ConnectionStatus
from app.models.notification import Notification
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.connection import ConnectionListResponse, ConnectionRequestResponse
from app.services.email_service import send_connection_accepted_email
from app.utils.user_mapper import to_user_public

router = APIRouter(prefix="/connections", tags=["Connections"])


def _to_response(conn: Connection) -> ConnectionRequestResponse:
    return ConnectionRequestResponse(
        id=conn.id,
        sender_id=conn.sender_id,
        receiver_id=conn.receiver_id,
        status=conn.status.value,
        created_at=conn.created_at,
        sender=to_user_public(conn.sender) if conn.sender else None,
        receiver=to_user_public(conn.receiver) if conn.receiver else None,
    )


async def _get_connection_or_404(
    db: AsyncSession, connection_id: UUID
) -> Connection:
    result = await db.execute(
        select(Connection)
        .options(selectinload(Connection.sender), selectinload(Connection.receiver))
        .where(Connection.id == connection_id)
    )
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found")
    return conn


async def _notify(db: AsyncSession, user_id: UUID, ntype: str, content: str) -> None:
    db.add(Notification(user_id=user_id, type=ntype, content=content))


@router.post("/request/{user_id}", response_model=dict, status_code=status.HTTP_201_CREATED)
async def send_connection_request(
    user_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot connect with yourself")

    target = await db.execute(select(User).where(User.id == user_id))
    if not target.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    existing = await db.execute(
        select(Connection).where(
            or_(
                (Connection.sender_id == current_user.id) & (Connection.receiver_id == user_id),
                (Connection.sender_id == user_id) & (Connection.receiver_id == current_user.id),
            )
        )
    )
    conn = existing.scalar_one_or_none()
    if conn:
        if conn.status == ConnectionStatus.accepted:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Already connected")
        if conn.status == ConnectionStatus.pending:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request already pending")
        conn.status = ConnectionStatus.pending
        conn.sender_id = current_user.id
        conn.receiver_id = user_id
    else:
        conn = Connection(
            sender_id=current_user.id,
            receiver_id=user_id,
            status=ConnectionStatus.pending,
        )
        db.add(conn)

    await db.flush()
    await _notify(
        db,
        user_id,
        "connection_request",
        f"{current_user.name} sent you a connection request",
    )
    await db.refresh(conn, ["sender", "receiver"])
    return {"connection": _to_response(conn)}


@router.post("/accept/{request_id}", response_model=dict)
async def accept_connection_request(
    request_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    conn = await _get_connection_or_404(db, request_id)
    if conn.receiver_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    if conn.status != ConnectionStatus.pending:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request is not pending")

    conn.status = ConnectionStatus.accepted
    await db.flush()
    await _notify(
        db,
        conn.sender_id,
        "connection_accepted",
        f"{current_user.name} accepted your connection request",
    )
    if conn.sender:
        await send_connection_accepted_email(conn.sender.email, conn.sender.name, current_user.name)
    await db.refresh(conn, ["sender", "receiver"])
    return {"connection": _to_response(conn)}


@router.post("/reject/{request_id}", response_model=dict)
async def reject_connection_request(
    request_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    conn = await _get_connection_or_404(db, request_id)
    if conn.receiver_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    if conn.status != ConnectionStatus.pending:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request is not pending")

    conn.status = ConnectionStatus.rejected
    await db.flush()
    await db.refresh(conn, ["sender", "receiver"])
    return {"connection": _to_response(conn)}


@router.delete("/request/{request_id}", response_model=MessageResponse)
async def cancel_connection_request(
    request_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    conn = await _get_connection_or_404(db, request_id)
    if conn.sender_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    if conn.status != ConnectionStatus.pending:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only pending requests can be cancelled")
    await db.delete(conn)
    return MessageResponse(message="Connection request cancelled")


@router.get("", response_model=ConnectionListResponse)
async def list_connections(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Connection)
        .options(selectinload(Connection.sender), selectinload(Connection.receiver))
        .where(
            Connection.status == ConnectionStatus.accepted,
            or_(Connection.sender_id == current_user.id, Connection.receiver_id == current_user.id),
        )
        .order_by(Connection.created_at.desc())
    )
    items = [_to_response(c) for c in result.scalars().all()]
    return ConnectionListResponse(connections=items, total=len(items))


@router.get("/received", response_model=ConnectionListResponse)
async def list_received_requests(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Connection)
        .options(selectinload(Connection.sender), selectinload(Connection.receiver))
        .where(
            Connection.receiver_id == current_user.id,
            Connection.status == ConnectionStatus.pending,
        )
        .order_by(Connection.created_at.desc())
    )
    items = [_to_response(c) for c in result.scalars().all()]
    return ConnectionListResponse(connections=items, total=len(items))


@router.get("/sent", response_model=ConnectionListResponse)
async def list_sent_requests(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Connection)
        .options(selectinload(Connection.sender), selectinload(Connection.receiver))
        .where(
            Connection.sender_id == current_user.id,
            Connection.status == ConnectionStatus.pending,
        )
        .order_by(Connection.created_at.desc())
    )
    items = [_to_response(c) for c in result.scalars().all()]
    return ConnectionListResponse(connections=items, total=len(items))


@router.get("/status/{user_id}", response_model=dict)
async def connection_status(
    user_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if user_id == current_user.id:
        return {"status": "self"}
    result = await db.execute(
        select(Connection).where(
            or_(
                (Connection.sender_id == current_user.id) & (Connection.receiver_id == user_id),
                (Connection.sender_id == user_id) & (Connection.receiver_id == current_user.id),
            )
        )
    )
    conn = result.scalar_one_or_none()
    if not conn:
        return {"status": "none", "connection_id": None}
    return {"status": conn.status.value, "connection_id": str(conn.id), "is_sender": conn.sender_id == current_user.id}


@router.delete("/{connection_id}", response_model=MessageResponse)
async def remove_connection(
    connection_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    conn = await _get_connection_or_404(db, connection_id)
    if current_user.id not in (conn.sender_id, conn.receiver_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    if conn.status != ConnectionStatus.accepted:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only accepted connections can be removed")
    await db.delete(conn)
    return MessageResponse(message="Connection removed")
