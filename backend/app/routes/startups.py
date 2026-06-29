from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import CurrentUser
from app.models.startup import Startup, StartupPosition
from app.schemas.startup import PositionResponse, StartupCreate, StartupListResponse, StartupResponse, StartupUpdate

router = APIRouter(prefix="/startups", tags=["Startups"])


@router.get("", response_model=StartupListResponse)
async def list_startups(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * limit
    total_result = await db.execute(select(func.count()).select_from(Startup))
    total = total_result.scalar() or 0
    result = await db.execute(select(Startup).order_by(Startup.created_at.desc()).offset(offset).limit(limit))
    startups = [StartupResponse.model_validate(s) for s in result.scalars().all()]
    return StartupListResponse(
        startups=startups,
        page=page,
        limit=limit,
        total=total,
        has_more=(offset + limit) < total,
    )


@router.get("/{startup_id}", response_model=dict)
async def get_startup(startup_id: UUID, db: AsyncSession = Depends(get_db)):
    startup = await db.get(Startup, startup_id)
    if not startup:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Startup not found")
    return {"startup": StartupResponse.model_validate(startup)}


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_startup(body: StartupCreate, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    role = current_user.role.value if hasattr(current_user.role, "value") else current_user.role
    if role not in ["founder", "executive"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only founders and executives can create startups")
    
    startup = Startup(creator_id=current_user.id, **body.model_dump())
    db.add(startup)
    await db.flush()
    return {"startup": StartupResponse.model_validate(startup)}


@router.patch("/{startup_id}", response_model=dict)
async def update_startup(
    startup_id: UUID,
    body: StartupUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    startup = await db.get(Startup, startup_id)
    if not startup:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Startup not found")
    if startup.creator_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(startup, key, value)
    await db.flush()
    return {"startup": StartupResponse.model_validate(startup)}


@router.get("/{startup_id}/positions", response_model=dict)
async def get_positions(startup_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(StartupPosition).where(StartupPosition.startup_id == startup_id).order_by(
            StartupPosition.created_at.desc()
        )
    )
    positions = [PositionResponse.model_validate(p) for p in result.scalars().all()]
    return {"positions": positions}


@router.post("/{startup_id}/positions", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_position(
    startup_id: UUID,
    body: dict,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db)
):
    startup = await db.get(Startup, startup_id)
    if not startup:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Startup not found")
        
    role = current_user.role.value if hasattr(current_user.role, "value") else current_user.role
    if startup.creator_id != current_user.id and role not in ["founder", "executive"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to post opportunities")

    position = StartupPosition(
        startup_id=startup_id,
        title=body.get("title", ""),
        description=body.get("description", ""),
        location=body.get("location", ""),
        type=body.get("type", ""),
        skills_required=body.get("skills_required", []),
        experience_required=body.get("experience_required", None),
        compensation=body.get("compensation", None),
        equity=body.get("equity", None),
        contact_email=body.get("contact_email", None)
    )
    db.add(position)
    await db.flush()
    
    return {"position": PositionResponse.model_validate(position)}


@router.delete("/positions/{position_id}", response_model=dict)
async def delete_position(
    position_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db)
):
    position = await db.get(StartupPosition, position_id)
    if not position:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Position not found")
        
    startup = await db.get(Startup, position.startup_id)
    if startup and startup.creator_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        
    await db.delete(position)
    await db.flush()
    return {"message": "Position deleted"}
