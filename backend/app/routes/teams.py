from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies.auth import CurrentUser
from app.models.team import Team, TeamChannel, team_members
from app.models.user import User
from app.schemas.team import ChannelCreate, ChannelResponse, TeamCreate, TeamInvite, TeamResponse

router = APIRouter(prefix="/teams", tags=["Teams"])


@router.get("", response_model=dict)
async def get_my_teams(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Team)
        .join(team_members)
        .where(team_members.c.user_id == current_user.id)
        .order_by(Team.created_at.desc())
    )
    teams = []
    for t in result.scalars().unique().all():
        count = await db.execute(
            select(func.count()).select_from(team_members).where(team_members.c.team_id == t.id)
        )
        teams.append(
            TeamResponse(
                id=t.id,
                name=t.name,
                description=t.description,
                creator_id=t.creator_id,
                member_count=count.scalar() or 0,
                created_at=t.created_at,
            )
        )
    return {"teams": teams}


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_team(body: TeamCreate, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    team = Team(name=body.name, description=body.description, creator_id=current_user.id, members=[current_user])
    general = TeamChannel(name="general", team=team)
    db.add(team)
    db.add(general)
    await db.flush()
    return {
        "team": TeamResponse(
            id=team.id,
            name=team.name,
            description=team.description,
            creator_id=team.creator_id,
            member_count=1,
            created_at=team.created_at,
        )
    }


@router.get("/{team_id}", response_model=dict)
async def get_team(team_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Team).where(Team.id == team_id))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    count = await db.execute(select(func.count()).select_from(team_members).where(team_members.c.team_id == t.id))
    return {
        "team": TeamResponse(
            id=t.id,
            name=t.name,
            description=t.description,
            creator_id=t.creator_id,
            member_count=count.scalar() or 0,
            created_at=t.created_at,
        )
    }


@router.post("/{team_id}/invite", response_model=dict)
async def invite_member(
    team_id: UUID,
    body: TeamInvite,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Team).options(selectinload(Team.members)).where(Team.id == team_id)
    )
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    if team.creator_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only team creator can invite")

    user_result = await db.execute(select(User).where(User.email == body.email))
    invitee = user_result.scalar_one_or_none()
    if not invitee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if invitee not in team.members:
        team.members.append(invitee)
    return {"message": f"Invited {body.email}"}


@router.get("/{team_id}/channels", response_model=dict)
async def get_channels(team_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TeamChannel).where(TeamChannel.team_id == team_id).order_by(TeamChannel.created_at.asc())
    )
    channels = [
        ChannelResponse(id=c.id, name=c.name, created_at=c.created_at) for c in result.scalars().all()
    ]
    return {"channels": channels}


@router.post("/{team_id}/channels", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_channel(
    team_id: UUID,
    body: ChannelCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Team).where(Team.id == team_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    channel = TeamChannel(team_id=team_id, name=body.name)
    db.add(channel)
    await db.flush()
    return {"channel": ChannelResponse(id=channel.id, name=channel.name, created_at=channel.created_at)}
