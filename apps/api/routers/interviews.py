from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_clerk_id
from config import settings
from db import get_db
from models import Interview, User
from services import livekit

router = APIRouter()

PRESETS = [
    "Web Development",
    "Generative AI",
    "AI & ML",
    "DSA",
    "System Design",
]
DURATIONS = [600, 1200, 1800, 2700]


class InterviewIn(BaseModel):
    topic: str
    duration_sec: int


def session_payload(interview: Interview, token: str | None) -> dict:
    return {
        "id": interview.id,
        "topic": interview.topic,
        "duration_sec": interview.duration_sec,
        "room_name": interview.room_name,
        "status": interview.status,
        "token": token,
        "livekit_url": settings.livekit_url if token else None,
    }


@router.get("/api/presets")
async def presets(clerk_id: str = Depends(get_clerk_id)):
    return {"presets": PRESETS, "durations": DURATIONS}


@router.post("/api/interviews")
async def create_interview(
    payload: InterviewIn,
    clerk_id: str = Depends(get_clerk_id),
    db: AsyncSession = Depends(get_db),
):
    topic = payload.topic.strip()
    if not topic:
        raise HTTPException(status_code=422, detail="Topic is required")
    if payload.duration_sec not in DURATIONS:
        raise HTTPException(status_code=422, detail="Unsupported duration")

    user = (await db.execute(select(User).where(User.clerk_id == clerk_id))).scalar_one_or_none()
    if user is None or not user.onboarding_complete:
        raise HTTPException(status_code=409, detail="Onboarding is not complete")

    interview = Interview(user_id=user.id, topic=topic, duration_sec=payload.duration_sec, room_name="pending")
    db.add(interview)
    await db.flush()
    interview.room_name = f"im-{user.id}-{interview.id}"

    token = None
    if livekit.is_configured():
        await livekit.ensure_room(interview.room_name)
        token = livekit.mint_participant_token(interview.room_name, clerk_id, user.name or "Candidate")

    await db.commit()
    return session_payload(interview, token)


@router.get("/api/interviews/{interview_id}")
async def get_interview(
    interview_id: int,
    clerk_id: str = Depends(get_clerk_id),
    db: AsyncSession = Depends(get_db),
):
    interview = (await db.execute(select(Interview).where(Interview.id == interview_id))).scalar_one_or_none()
    if interview is None:
        raise HTTPException(status_code=404, detail="Interview not found")

    user = (await db.execute(select(User).where(User.id == interview.user_id))).scalar_one_or_none()
    if user.clerk_id != clerk_id:
        raise HTTPException(status_code=403, detail="Not your interview")

    token = None
    if livekit.is_configured() and interview.status != "completed":
        token = livekit.mint_participant_token(interview.room_name, clerk_id, user.name or "Candidate")

    return session_payload(interview, token)
