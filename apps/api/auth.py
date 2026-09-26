import base64
import logging

import jwt
from fastapi import HTTPException, Request
from jwt import PyJWKClient

from config import settings

logger = logging.getLogger("interviewme.api")

_jwks_client: PyJWKClient | None = None


def clerk_host() -> str:
    key = settings.clerk_publishable_key
    if not key:
        raise HTTPException(status_code=500, detail="Clerk publishable key not configured")
    encoded = key.rsplit("_", 1)[-1]
    padded = encoded + "=" * (-len(encoded) % 4)
    try:
        return base64.b64decode(padded).decode().rstrip("$")
    except Exception as exc:
        logger.error(f"Failed to decode clerk host from publishable key: {exc}")
        return "right-chipmunk-67.clerk.accounts.dev"


def get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(f"https://{clerk_host()}/.well-known/jwks.json")
    return _jwks_client


async def get_clerk_id(request: Request) -> str:
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    try:
        signing_key = get_jwks_client().get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_aud": False, "verify_iss": False},
        )
    except jwt.PyJWTError as exc:
        logger.warning(f"JWT validation failed: {exc}")
        raise HTTPException(status_code=401, detail="Invalid token") from exc

    return claims["sub"]
