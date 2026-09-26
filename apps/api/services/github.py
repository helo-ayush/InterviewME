from collections import Counter

import httpx

GITHUB_API = "https://api.github.com"


async def exchange_code_for_token(code: str) -> str:
    from config import settings

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            f"{GITHUB_API}/login/oauth/access_token",
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
