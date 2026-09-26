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
from services import livekit, reviewer

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
    code_workspace: dict | None = None


class EndInterviewIn(BaseModel):
    code_workspace: dict | None = None


def session_payload(interview: Interview, token: str | None) -> dict:
    return {
        "id": interview.id,
        "topic": interview.topic,
        "duration_sec": interview.duration_sec,
        "room_name": interview.room_name,
        "status": interview.status,
        "token": token,
        "livekit_url": settings.livekit_url if token else None,
        "transcript": interview.transcript or [],
        "review": interview.review or {},
        "created_at": interview.created_at.isoformat() if interview.created_at else None,
        "ended_at": interview.ended_at.isoformat() if interview.ended_at else None,
    }


@router.get("/api/presets")
async def presets(clerk_id: str = Depends(get_clerk_id)):
    return {"presets": PRESETS, "durations": DURATIONS}


@router.get("/api/interviews")
async def list_interviews(
    clerk_id: str = Depends(get_clerk_id),
    db: AsyncSession = Depends(get_db),
):
    """List all interviews and reviews for the logged-in candidate."""
    user = (await db.execute(select(User).where(User.clerk_id == clerk_id))).scalar_one_or_none()
    if not user:
        return []

    result = await db.execute(
        select(Interview).where(Interview.user_id == user.id).order_by(Interview.created_at.desc())
    )
    interviews = result.scalars().all()
    return [
        {
            "id": iv.id,
            "topic": iv.topic,
            "duration_sec": iv.duration_sec,
            "status": iv.status,
            "started_at": iv.started_at.isoformat() if iv.started_at else None,
            "ended_at": iv.ended_at.isoformat() if iv.ended_at else None,
            "created_at": iv.created_at.isoformat() if iv.created_at else None,
            "overall_score": (iv.review or {}).get("overall_score") if iv.review else None,
            "recommendation": (iv.review or {}).get("recommendation") if iv.review else None,
            "summary": (iv.review or {}).get("summary") if iv.review else None,
            "category_scores": (iv.review or {}).get("category_scores") if iv.review else {},
            "turns_count": len(iv.transcript or []),
        }
        for iv in interviews
    ]


@router.post("/api/interviews")
async def create_interview(
    payload: InterviewIn,
    clerk_id: str = Depends(get_clerk_id),
    db: AsyncSession = Depends(get_db),
):
    topic = payload.topic.strip()
    if not topic:
        raise HTTPException(status_code=400, detail="Topic is required")

    user = (await db.execute(select(User).where(User.clerk_id == clerk_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

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


@router.get("/api/interviews/{interview_id}/review")
async def get_interview_review(
    interview_id: int,
    request: Request,
    clerk_id: str = Depends(get_clerk_id),
    db: AsyncSession = Depends(get_db),
):
    interview = (await db.execute(select(Interview).where(Interview.id == interview_id))).scalar_one_or_none()
    if interview is None:
        raise HTTPException(status_code=404, detail="Interview not found")

    user = (await db.execute(select(User).where(User.id == interview.user_id))).scalar_one_or_none()
    if user.clerk_id != clerk_id:
        raise HTTPException(status_code=403, detail="Not your interview")

    # Check if review needs generation or strict recalibration
    cand_turns = sum(1 for item in (interview.transcript or []) if item.get("role") not in ("agent", "assistant", "interviewer"))
    cand_words = sum(len((item.get("text") or "").split()) for item in (interview.transcript or []) if item.get("role") not in ("agent", "assistant", "interviewer"))
    is_minimal = cand_turns < 2 or cand_words < 20

    existing_score = (interview.review or {}).get("overall_score")
    needs_review = (
        not interview.review
        or existing_score is None
        or (is_minimal and existing_score > 15)
        or request.query_params.get("refresh") == "true"
    )

    if needs_review:
        candidate_info = {
            "name": user.name or "Candidate",
            "role": user.role or "Software Engineer",
            "experience_level": user.experience_level or "Junior",
            "skills": user.skills or [],
        }
        interview.review = await reviewer.generate_interview_review(
            topic=interview.topic,
            candidate_info=candidate_info,
            transcript=interview.transcript or [],
        )
        await db.commit()

    return {
        "interview_id": interview.id,
        "topic": interview.topic,
        "duration_sec": interview.duration_sec,
        "status": interview.status,
        "created_at": interview.created_at.isoformat() if interview.created_at else None,
        "ended_at": interview.ended_at.isoformat() if interview.ended_at else None,
        "review": interview.review,
        "transcript": interview.transcript or [],
    }


@router.post("/api/interviews/{interview_id}/end")
async def end_interview(
    interview_id: int,
    payload: EndInterviewIn | None = None,
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

    # Generate review immediately if not yet generated
    if not interview.review or not interview.review.get("overall_score"):
        candidate_info = {
            "name": user.name or "Candidate",
            "role": user.role or "Software Engineer",
            "experience_level": user.experience_level or "Junior",
            "skills": user.skills or [],
        }
        interview.review = await reviewer.generate_interview_review(
            topic=interview.topic,
            candidate_info=candidate_info,
            transcript=interview.transcript or [],
            code_workspace=payload.code_workspace if payload else None,
        )

    await db.commit()
    return {"status": "completed", "interview_id": interview.id, "review": interview.review}


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

    # Generate review from transcript
    user = (await db.execute(select(User).where(User.id == interview.user_id))).scalar_one_or_none()
    if user:
        candidate_info = {
            "name": user.name or "Candidate",
            "role": user.role or "Software Engineer",
            "experience_level": user.experience_level or "Junior",
            "skills": user.skills or [],
        }
        interview.review = await reviewer.generate_interview_review(
            topic=interview.topic,
            candidate_info=candidate_info,
            transcript=interview.transcript or [],
            code_workspace=payload.code_workspace,
        )

    await db.commit()
    return {"status": "completed", "interview_id": interview.id, "review": interview.review}
