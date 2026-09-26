from pydantic_settings import BaseSettings


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

    groq_api_key: str = ""
    token_encryption_key: str = ""

    web_origin: str = "http://localhost:3000"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
