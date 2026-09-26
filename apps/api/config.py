from pathlib import Path
from pydantic_settings import BaseSettings

_ENV_FILE = Path(__file__).resolve().parent / ".env"


class Settings(BaseSettings):
    clerk_publishable_key: str = ""
    clerk_secret_key: str = ""

    database_url: str = ""

    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_resume_bucket: str = "resumes"

    github_client_id: str = ""
    github_client_secret: str = ""
    github_redirect_uri: str = "http://localhost:8000/api/github/oauth/callback"
    github_token: str = ""

    groq_api_key: str = ""
    token_encryption_key: str = ""

    livekit_url: str = ""
    livekit_api_key: str = ""
    livekit_api_secret: str = ""

    web_origin: str = "http://localhost:3000"
    internal_service_key: str = "interviewme-internal-key-dev"

    model_config = {"env_file": str(_ENV_FILE), "extra": "ignore"}


settings = Settings()
