from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    clerk_id: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String(200))
    role: Mapped[str | None] = mapped_column(String(200))
    experience_level: Mapped[str | None] = mapped_column(String(60))
    skills: Mapped[list] = mapped_column(JSONB, default=list)
    onboarding_complete: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    resume: Mapped["Resume | None"] = relationship(back_populates="user", uselist=False, lazy="selectin")
    github: Mapped["GithubAccount | None"] = relationship(back_populates="user", uselist=False, lazy="selectin")


class Resume(Base):
    __tablename__ = "resumes"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    filename: Mapped[str] = mapped_column(String(300))
    storage_path: Mapped[str | None] = mapped_column(String(500))
    extracted_text: Mapped[str] = mapped_column(Text)
    llm_summary: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship(back_populates="resume")


class GithubAccount(Base):
    __tablename__ = "github_accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    github_login: Mapped[str] = mapped_column(String(120))
    access_token: Mapped[str] = mapped_column(Text)
    connected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship(back_populates="github")


class GithubSnapshot(Base):
    __tablename__ = "github_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    repos: Mapped[list] = mapped_column(JSONB, default=list)
    tech_stack: Mapped[list] = mapped_column(JSONB, default=list)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Interview(Base):
    __tablename__ = "interviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    topic: Mapped[str] = mapped_column(String(300))
    duration_sec: Mapped[int]
    room_name: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(30), default="scheduled")
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    transcript: Mapped[list] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
