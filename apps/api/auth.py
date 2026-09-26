import base64
import logging

import jwt
from fastapi import HTTPException, Request
from jwt import PyJWKClient

from config import settings

logger = logging.getLogger("interviewme.api")

_jwks_client: PyJWKClient | None = None


def clerk_host() -> str:
    prefix, _, encoded = settings.clerk_publishable_key.partition("_")
    if not encoded:
        raise HTTPException(status_code=500, detail="Clerk publishable key not configured")
    padded = encoded + "=" * (-len(encoded) % 4)
    return base64.b64decode(padded).decode().rstrip("$")


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
            audience=clerk_host(),
            options={"verify_iss": False},
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc

    return claims["sub"]
