import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers import github as github_router
from routers import onboarding as onboarding_router

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("interviewme.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.database_url:
        from db import Base, engine

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables ensured")
    else:
        logger.warning("DATABASE_URL not set — running without database")
    yield


app = FastAPI(title="InterviewME API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.web_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(onboarding_router.router)
app.include_router(github_router.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
