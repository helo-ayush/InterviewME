from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_clerk_id
from config import settings
from db import get_db
from models import GithubAccount, GithubSnapshot, User
from services import crypto, github as github_service

router = APIRouter()


@router.get("/api/github/oauth/start")
async def start(clerk_id: str = Depends(get_clerk_id)):
    if not settings.github_client_id:
        raise HTTPException(status_code=503, detail="GitHub OAuth is not configured")
    params = {
        "client_id": settings.github_client_id,
        "redirect_uri": settings.github_redirect_uri,
        "scope": "repo",
        "state": crypto.encrypt(clerk_id),
    }
    query = "&".join(f"{k}={quote(str(v))}" for k, v in params.items())
    return {"url": f"https://github.com/login/oauth/authorize?{query}"}


@router.get("/api/github/oauth/callback")
async def callback(request: Request, db: AsyncSession = Depends(get_db)):
    params = request.query_params
    code = params.get("code")
    state = params.get("state")
    if not code or not state:
        return RedirectResponse(f"{settings.web_origin}/onboarding?github=failed")

    try:
        clerk_id = crypto.decrypt(state)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    try:
        token = await github_service.exchange_code_for_token(code)
        login, repos, tech_stack = await github_service.fetch_account_and_snapshot(token)
    except Exception:
        return RedirectResponse(f"{settings.web_origin}/onboarding?github=failed")

    db_user = (await db.execute(select(User).where(User.clerk_id == clerk_id))).scalar_one_or_none()
    if db_user is None:
        db_user = User(clerk_id=clerk_id)
        db.add(db_user)
        await db.flush()

    account = (await db.execute(select(GithubAccount).where(GithubAccount.user_id == db_user.id))).scalar_one_or_none()
    if account is None:
        account = GithubAccount(user_id=db_user.id, github_login=login, access_token=crypto.encrypt(token))
        db.add(account)
    else:
        account.github_login = login
        account.access_token = crypto.encrypt(token)

    snapshot = (await db.execute(select(GithubSnapshot).where(GithubSnapshot.user_id == db_user.id))).scalar_one_or_none()
    if snapshot is None:
        snapshot = GithubSnapshot(user_id=db_user.id, repos=repos, tech_stack=tech_stack)
        db.add(snapshot)
    else:
        snapshot.repos = repos
        snapshot.tech_stack = tech_stack

    await db.commit()
    return RedirectResponse(f"{settings.web_origin}/onboarding?github=connected")
