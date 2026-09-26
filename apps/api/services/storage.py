import httpx

from config import settings


async def upload_resume(clerk_id: str, filename: str, data: bytes) -> str | None:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return None

    path = f"{clerk_id}/{filename}"
    url = f"{settings.supabase_url}/storage/v1/object/{settings.supabase_resume_bucket}/{path}"
    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(
            url,
            content=data,
            headers={
                "Authorization": f"Bearer {settings.supabase_service_role_key}",
                "apiKey": settings.supabase_service_role_key,
                "Content-Type": "application/octet-stream",
                "x-upsert": "true",
            },
        )
        res.raise_for_status()
    return path
