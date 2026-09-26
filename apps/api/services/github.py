import re
from collections import Counter
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException

GITHUB_API = "https://api.github.com"

RESERVED_GITHUB_NAMES = {
    "login", "join", "pricing", "features", "explore", "topics", "collections",
    "marketplace", "settings", "orgs", "organizations", "pulls", "issues",
    "notifications", "site", "about", "contact", "security", "customer-stories",
    "enterprise", "team", "readme", "search", "trending", "stars", "sponsors",
}


def extract_github_username(raw: str) -> str:
    """Extract a clean GitHub username from a username, handle (@user), or profile/repo URL."""
    if not raw or not isinstance(raw, str):
        return ""
    val = raw.strip()
    if val.startswith("@"):
        val = val[1:].strip()

    if "github.com" in val.lower():
        if not val.startswith(("http://", "https://")):
            val = "https://" + val
        try:
            parsed = urlparse(val)
            parts = [p for p in parsed.path.split("/") if p]
            if not parts:
                return ""
            val = parts[0]
        except Exception:
            pass
    elif "://" in val:
        # URL of a different service
        return ""
    elif "/" in val:
        parts = [p for p in val.split("/") if p]
        if parts:
            val = parts[0]

    val = val.split("?")[0].split("#")[0].strip("/").strip()

    match = re.match(r"^([a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38})$", val)
    if match:
        return match.group(1)

    return ""


async def exchange_code_for_token(code: str) -> str:
    from config import settings

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            "https://github.com/login/oauth/access_token",
            json={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
                "redirect_uri": settings.github_redirect_uri,
            },
            headers={"Accept": "application/json"},
        )
        res.raise_for_status()
        token = res.json().get("access_token")
    if not token:
        raise ValueError("GitHub did not return an access token")
    return token


async def fetch_account_and_snapshot(token: str) -> tuple[str, list[dict], list[str]]:
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}
    async with httpx.AsyncClient(timeout=60) as client:
        user_res = await client.get(f"{GITHUB_API}/user", headers=headers)
        user_res.raise_for_status()
        login = user_res.json()["login"]

        repos_res = await client.get(
            f"{GITHUB_API}/user/repos",
            headers=headers,
            params={"per_page": 100, "sort": "updated", "affiliation": "owner,collaborator"},
        )
        repos_res.raise_for_status()
        raw_repos = repos_res.json()

    repos = [
        {
            "name": r["name"],
            "full_name": r["full_name"],
            "description": (r.get("description") or "")[:300],
            "language": r.get("language"),
            "topics": (r.get("topics") or [])[:10],
            "stars": r.get("stargazers_count", 0),
            "fork": bool(r.get("fork")),
            "updated_at": r.get("updated_at"),
        }
        for r in raw_repos
    ]

    languages = Counter(r["language"] for r in repos if r["language"])
    topics = Counter(t for r in repos for t in r["topics"])
    tech_stack = [lang for lang, _ in languages.most_common(8)] + [t for t, _ in topics.most_common(8)]

    return login, repos, tech_stack


async def fetch_public_account_and_snapshot(username: str) -> tuple[str, list[dict], list[str]]:
    from config import settings

    headers = {"User-Agent": "InterviewME-App", "Accept": "application/vnd.github+json"}
    if settings.github_token:
        headers["Authorization"] = f"Bearer {settings.github_token}"

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            user_res = await client.get(f"{GITHUB_API}/users/{username}", headers=headers)
            if user_res.status_code == 404:
                raise HTTPException(status_code=404, detail=f"GitHub user '{username}' was not found. Please verify the profile link or username.")
            if user_res.status_code == 403:
                raise HTTPException(status_code=429, detail="GitHub API rate limit reached. Please wait a few moments or try again.")
            user_res.raise_for_status()
            user_data = user_res.json()
            login = user_data.get("login", username)

            repos_res = await client.get(
                f"{GITHUB_API}/users/{username}/repos",
                headers=headers,
                params={"per_page": 50, "sort": "updated", "type": "owner"},
            )
            if repos_res.status_code == 403:
                raise HTTPException(status_code=429, detail="GitHub API rate limit reached. Please wait a few moments or try again.")
            repos_res.raise_for_status()
            raw_repos = repos_res.json()
            if not isinstance(raw_repos, list):
                raw_repos = []
    except HTTPException:
        raise
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="GitHub API timed out while fetching repositories.")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not connect to GitHub API: {str(exc)}")

    repos = [
        {
            "name": r.get("name", "untitled"),
            "full_name": r.get("full_name", f"{login}/{r.get('name', 'untitled')}"),
            "description": (r.get("description") or "")[:300],
            "language": r.get("language"),
            "topics": (r.get("topics") or [])[:10],
            "stars": r.get("stargazers_count", 0),
            "fork": bool(r.get("fork")),
            "updated_at": r.get("updated_at"),
        }
        for r in raw_repos
        if isinstance(r, dict)
    ]

    languages = Counter(r["language"] for r in repos if r["language"])
    topics = Counter(t for r in repos for t in r["topics"])
    tech_stack = [lang for lang, _ in languages.most_common(8)] + [t for t, _ in topics.most_common(8)]

    return login, repos, tech_stack

