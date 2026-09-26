from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_clerk_id
from db import get_db
from models import GithubAccount, Resume, User
from services import resume as resume_service
from services import storage as storage_service

router = APIRouter()

MAX_RESUME_BYTES = 10 * 1024 * 1024


class ProfileIn(BaseModel):
    name: str
    role: str
    experience_level: str
    skills: list[str] = []


async def get_or_create_user(db: AsyncSession, clerk_id: str) -> User:
    user = (await db.execute(select(User).where(User.clerk_id == clerk_id))).scalar_one_or_none()
    if user is None:
        user = User(clerk_id=clerk_id)
        db.add(user)
        await db.flush()
    return user


def profile_payload(user: User) -> dict:
    return {
        "clerk_id": user.clerk_id,
        "name": user.name,
        "role": user.role,
        "experience_level": user.experience_level,
        "skills": user.skills or [],
        "onboarding_complete": user.onboarding_complete,
        "resume": {"filename": user.resume.filename} if user.resume else None,
        "github": {"login": user.github.github_login} if user.github else None,
    }


@router.get("/api/me")
async def me(clerk_id: str = Depends(get_clerk_id), db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(User).where(User.clerk_id == clerk_id))).scalar_one_or_none()
    if user is None:
        return {
            "clerk_id": clerk_id,
            "name": None,
            "role": None,
            "experience_level": None,
            "skills": [],
            "onboarding_complete": False,
            "resume": None,
            "github": None,
        }
    return profile_payload(user)


@router.post("/api/onboarding/profile")
async def save_profile(
    payload: ProfileIn,
    clerk_id: str = Depends(get_clerk_id),
    db: AsyncSession = Depends(get_db),
):
    user = await get_or_create_user(db, clerk_id)
    user.name = payload.name
    user.role = payload.role
    user.experience_level = payload.experience_level
    user.skills = payload.skills
    await db.commit()
    return profile_payload(user)


@router.post("/api/onboarding/resume")
async def upload_resume(
    file: UploadFile = File(...),
    clerk_id: str = Depends(get_clerk_id),
    db: AsyncSession = Depends(get_db),
):
    data = await file.read()
    if len(data) > MAX_RESUME_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")

    text = resume_service.extract_text(file.filename or "resume.pdf", data)
    storage_path = await storage_service.upload_resume(clerk_id, file.filename or "resume.pdf", data)

    user = await get_or_create_user(db, clerk_id)
    existing = (await db.execute(select(Resume).where(Resume.user_id == user.id))).scalar_one_or_none()
    if existing:
        existing.filename = file.filename or "resume.pdf"
        existing.storage_path = storage_path
        existing.extracted_text = text
        resume = existing
    else:
        resume = Resume(user_id=user.id, filename=file.filename or "resume.pdf", storage_path=storage_path, extracted_text=text)
        db.add(resume)
    await db.commit()
    return {"filename": resume.filename, "chars": len(text)}


@router.post("/api/onboarding/complete")
async def complete(
    clerk_id: str = Depends(get_clerk_id),
    db: AsyncSession = Depends(get_db),
):
    user = (await db.execute(select(User).where(User.clerk_id == clerk_id))).scalar_one_or_none()
    if user is None or not user.name:
        raise HTTPException(status_code=409, detail="Profile not completed")

    has_resume = (await db.execute(select(Resume.id).where(Resume.user_id == user.id))).scalar_one_or_none()
    has_github = (await db.execute(select(GithubAccount.id).where(GithubAccount.user_id == user.id))).scalar_one_or_none()
    if not has_resume or not has_github:
        raise HTTPException(status_code=409, detail="Resume and GitHub connection are required")

    user.onboarding_complete = True
    await db.commit()
    return profile_payload(user)
