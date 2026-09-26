import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_clerk_id
from config import settings
from db import get_db
from models import GithubAccount, GithubSnapshot, Interview, Resume, User
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


class FinishInterviewIn(BaseModel):
    transcript: list[dict] = []
    status: str = "completed"


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
        room_meta = json.dumps({"context_id": interview.id, "topic": topic, "duration_sec": interview.duration_sec})
        await livekit.ensure_room(interview.room_name, metadata=room_meta)
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


@router.post("/api/interviews/{interview_id}/end")
async def end_interview(
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

    interview.status = "completed"
    interview.ended_at = datetime.now(timezone.utc)
    await db.commit()
    return {"status": "completed", "interview_id": interview.id}


@router.get("/internal/candidate-context/{interview_id}")
async def get_candidate_context(
    interview_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    key = request.headers.get("X-Service-Key")
    if settings.internal_service_key and key != settings.internal_service_key:
        raise HTTPException(status_code=403, detail="Invalid internal service key")

    interview = (await db.execute(select(Interview).where(Interview.id == interview_id))).scalar_one_or_none()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    user = (await db.execute(select(User).where(User.id == interview.user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    resume = (await db.execute(select(Resume).where(Resume.user_id == user.id))).scalar_one_or_none()
    snapshot = (await db.execute(select(GithubSnapshot).where(GithubSnapshot.user_id == user.id))).scalar_one_or_none()
    github_acc = (await db.execute(select(GithubAccount).where(GithubAccount.user_id == user.id))).scalar_one_or_none()

    return {
        "interview_id": interview.id,
        "topic": interview.topic,
        "duration_sec": interview.duration_sec,
        "status": interview.status,
        "candidate": {
            "name": user.name or "Candidate",
            "role": user.role or "Software Engineer",
            "experience_level": user.experience_level or "Junior",
            "skills": user.skills or [],
        },
        "resume": {
            "filename": resume.filename if resume else None,
            "summary": resume.llm_summary if resume else None,
            "text": (resume.extracted_text[:4000] if resume and resume.extracted_text else None),
        } if resume else None,
        "github": {
            "login": github_acc.github_login if github_acc else None,
            "tech_stack": snapshot.tech_stack if snapshot else [],
            "repos": (snapshot.repos[:15] if snapshot and snapshot.repos else []),
        } if github_acc else None,
    }


@router.post("/internal/interviews/{interview_id}/finish")
async def finish_interview(
    interview_id: int,
    payload: FinishInterviewIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    key = request.headers.get("X-Service-Key")
    if settings.internal_service_key and key != settings.internal_service_key:
        raise HTTPException(status_code=403, detail="Invalid internal service key")

    interview = (await db.execute(select(Interview).where(Interview.id == interview_id))).scalar_one_or_none()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    interview.status = "completed"
    interview.ended_at = datetime.now(timezone.utc)
    if payload.transcript:
        interview.transcript = payload.transcript

    await db.commit()
    return {"status": "completed", "interview_id": interview.id}
