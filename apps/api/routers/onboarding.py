from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_clerk_id
from db import get_db
from models import GithubAccount, GithubSnapshot, Resume, User
from services import github as github_service
from services import resume as resume_service
from services import storage as storage_service

router = APIRouter()

MAX_RESUME_BYTES = 10 * 1024 * 1024


class ProfileIn(BaseModel):
    name: str
    role: str
    experience_level: str
    skills: list[str] = []


class ProfileUpdateIn(BaseModel):
    name: str | None = None
    role: str | None = None
    experience_level: str | None = None
    skills: list[str] | None = None
    github_username: str | None = None
    resume_summary: str | None = None


async def get_or_create_user(db: AsyncSession, clerk_id: str) -> User:
    user = (await db.execute(select(User).where(User.clerk_id == clerk_id))).scalar_one_or_none()
    if user is None:
        user = User(clerk_id=clerk_id)
        db.add(user)
        await db.flush()
    return user


def profile_payload(user: User, snapshot: GithubSnapshot | None = None) -> dict:
    resume_info = None
    try:
        if user.resume:
            resume_info = {
                "filename": user.resume.filename,
                "summary": user.resume.llm_summary,
            }
    except Exception:
        pass

    github_info = None
    try:
        if user.github:
            github_info = {
                "login": user.github.github_login,
                "repos_count": len(snapshot.repos or []) if snapshot else 0,
                "tech_stack": (snapshot.tech_stack or [])[:6] if snapshot else [],
            }
    except Exception:
        pass

    return {
        "clerk_id": user.clerk_id,
        "name": user.name,
        "role": user.role,
        "experience_level": user.experience_level,
        "skills": user.skills or [],
        "onboarding_complete": user.onboarding_complete,
        "resume": resume_info,
        "github": github_info,
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
    snapshot = (await db.execute(select(GithubSnapshot).where(GithubSnapshot.user_id == user.id))).scalar_one_or_none()
    return profile_payload(user, snapshot)


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
    snapshot = (await db.execute(select(GithubSnapshot).where(GithubSnapshot.user_id == user.id))).scalar_one_or_none()
    return profile_payload(user, snapshot)


@router.get("/api/profile")
async def get_profile(
    clerk_id: str = Depends(get_clerk_id),
    db: AsyncSession = Depends(get_db),
):
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
    snapshot = (await db.execute(select(GithubSnapshot).where(GithubSnapshot.user_id == user.id))).scalar_one_or_none()
    return profile_payload(user, snapshot)


@router.put("/api/profile")
@router.post("/api/profile")
async def update_profile(
    payload: ProfileUpdateIn,
    clerk_id: str = Depends(get_clerk_id),
    db: AsyncSession = Depends(get_db),
):
    user = await get_or_create_user(db, clerk_id)
    if payload.name is not None and payload.name.strip():
        user.name = payload.name.strip()
    if payload.role is not None and payload.role.strip():
        user.role = payload.role.strip()
    if payload.experience_level is not None and payload.experience_level.strip():
        user.experience_level = payload.experience_level.strip()
    if payload.skills is not None:
        user.skills = [s.strip() for s in payload.skills if s.strip()]

    # If resume summary updated
    if payload.resume_summary is not None and user.resume:
        user.resume.llm_summary = payload.resume_summary.strip()

    # If GitHub username provided and changed
    if payload.github_username is not None:
        clean = payload.github_username.strip()
        if clean:
            clean_username = github_service.extract_github_username(clean)
            if clean_username and clean_username.lower() not in github_service.RESERVED_GITHUB_NAMES:
                try:
                    login, repos, tech_stack = await github_service.fetch_public_account_and_snapshot(clean_username)
                    account = (await db.execute(select(GithubAccount).where(GithubAccount.user_id == user.id))).scalar_one_or_none()
                    if account is None:
                        account = GithubAccount(user_id=user.id, github_login=login, access_token="public_access")
                        db.add(account)
                    else:
                        account.github_login = login
                    
                    snapshot = (await db.execute(select(GithubSnapshot).where(GithubSnapshot.user_id == user.id))).scalar_one_or_none()
                    if snapshot is None:
                        snapshot = GithubSnapshot(user_id=user.id, repos=repos, tech_stack=tech_stack)
                        db.add(snapshot)
                    else:
                        snapshot.repos = repos
                        snapshot.tech_stack = tech_stack
                except Exception as exc:
                    pass

    await db.commit()
    snapshot = (await db.execute(select(GithubSnapshot).where(GithubSnapshot.user_id == user.id))).scalar_one_or_none()
    return profile_payload(user, snapshot)


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

    word_count = len(text.split())
    return {
        "filename": resume.filename,
        "chars": len(text),
        "words": word_count,
        "status": "extracted",
    }


class GithubLinkIn(BaseModel):
    username: str


@router.post("/api/onboarding/github-username")
async def link_github_username(
    payload: GithubLinkIn,
    clerk_id: str = Depends(get_clerk_id),
    db: AsyncSession = Depends(get_db),
):
    user = await get_or_create_user(db, clerk_id)
    raw_input = (payload.username or "").strip()
    if not raw_input:
        raise HTTPException(status_code=400, detail="Please enter a GitHub profile link or username.")

    if ("http://" in raw_input or "https://" in raw_input) and "github.com" not in raw_input.lower():
        raise HTTPException(
            status_code=400,
            detail="Please provide a valid GitHub link (e.g. https://github.com/your-username) or username."
        )

    clean_username = github_service.extract_github_username(raw_input)
    if not clean_username:
        raise HTTPException(
            status_code=400,
            detail="Could not extract a valid GitHub username from the provided input."
        )

    if clean_username.lower() in github_service.RESERVED_GITHUB_NAMES:
        raise HTTPException(
            status_code=400,
            detail=f"'{clean_username}' is a GitHub site page, not a candidate profile."
        )

    # Fetch public repositories and tech stack
    login, repos, tech_stack = await github_service.fetch_public_account_and_snapshot(clean_username)

    account = (await db.execute(select(GithubAccount).where(GithubAccount.user_id == user.id))).scalar_one_or_none()
    if account is None:
        account = GithubAccount(user_id=user.id, github_login=login, access_token="public_access")
        db.add(account)
    else:
        account.github_login = login
        account.access_token = "public_access"

    snapshot = (await db.execute(select(GithubSnapshot).where(GithubSnapshot.user_id == user.id))).scalar_one_or_none()
    if snapshot is None:
        snapshot = GithubSnapshot(user_id=user.id, repos=repos, tech_stack=tech_stack)
        db.add(snapshot)
    else:
        snapshot.repos = repos
        snapshot.tech_stack = tech_stack

    await db.commit()
    return {
        "login": login,
        "repos_count": len(repos),
        "tech_stack": tech_stack,
    }


@router.delete("/api/onboarding/github")
@router.post("/api/onboarding/github/disconnect")
async def disconnect_github(
    clerk_id: str = Depends(get_clerk_id),
    db: AsyncSession = Depends(get_db),
):
    user = (await db.execute(select(User).where(User.clerk_id == clerk_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    account = (await db.execute(select(GithubAccount).where(GithubAccount.user_id == user.id))).scalar_one_or_none()
    if account:
        await db.delete(account)

    snapshot = (await db.execute(select(GithubSnapshot).where(GithubSnapshot.user_id == user.id))).scalar_one_or_none()
    if snapshot:
        await db.delete(snapshot)

    await db.commit()
    return {"status": "disconnected"}


@router.post("/api/onboarding/complete")
async def complete(
    clerk_id: str = Depends(get_clerk_id),
    db: AsyncSession = Depends(get_db),
):
    user = (await db.execute(select(User).where(User.clerk_id == clerk_id))).scalar_one_or_none()
    if user is None or not user.name:
        raise HTTPException(status_code=409, detail="Profile not completed")

    user.onboarding_complete = True
    await db.commit()
    snapshot = (await db.execute(select(GithubSnapshot).where(GithubSnapshot.user_id == user.id))).scalar_one_or_none()
    return profile_payload(user, snapshot)

