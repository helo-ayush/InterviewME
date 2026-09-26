import logging
import os
import re
import httpx
from livekit.agents import llm

logger = logging.getLogger("interviewme.agent.github_tools")
GITHUB_API = "https://api.github.com"


def _clean_unicode(text: str) -> str:
    """Normalize unicode characters to avoid charmap codec issues on Windows."""
    if not text:
        return ""
    text = text.replace("\u2011", "-").replace("\u2013", "-").replace("\u2014", "--")
    text = text.replace("\u2192", "->").replace("\u2022", "*")
    return text.encode("ascii", errors="ignore").decode("ascii")


def _get_headers() -> dict:
    headers = {
        "User-Agent": "InterviewME-Agent",
        "Accept": "application/vnd.github.v3+json",
    }
    github_token = os.getenv("GITHUB_TOKEN")
    if github_token:
        headers["Authorization"] = f"Bearer {github_token}"
    return headers


def create_github_tools(default_owner: str | None = None) -> list[llm.FunctionTool]:
    """Factory creating GitHub investigation tools tailored to the candidate's profile."""
    owner_str = (default_owner or "").strip().lstrip("@")

    def _resolve(repo_name: str) -> tuple[str, str]:
        cleaned = (repo_name or "").strip().strip("/")
        if "/" in cleaned:
            parts = cleaned.split("/")
            return parts[0], parts[1]
        if owner_str:
            return owner_str, cleaned
        return "", cleaned

    @llm.function_tool(
        description=(
            "Fetch the README documentation of a candidate's GitHub repository. "
            "Use this when discussing a project to understand its architecture, features, tech stack, and motivation."
        )
    )
    async def fetch_repo_readme(repo_name: str) -> str:
        """Fetch README.md for a candidate's repository.
        Args:
            repo_name: The name of the repository (e.g. 'InterviewME' or 'username/InterviewME').
        """
        owner, repo = _resolve(repo_name)
        if not owner or not repo:
            return f"Could not determine repository owner for '{repo_name}'. Please specify as 'owner/repo'."

        logger.info("[Tool Call] Fetching README for %s/%s", owner, repo)
        url = f"{GITHUB_API}/repos/{owner}/{repo}/readme"
        raw_headers = {**_get_headers(), "Accept": "application/vnd.github.v3.raw"}

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                res = await client.get(url, headers=raw_headers)
                if res.status_code == 404:
                    # Fallback check for PLAN.md or docs
                    plan_res = await client.get(f"{GITHUB_API}/repos/{owner}/{repo}/contents/PLAN.md", headers=raw_headers)
                    if plan_res.status_code == 200:
                        content = _clean_unicode(plan_res.text[:2200])
                        return f"Found PLAN.md for {owner}/{repo}:\n{content}"
                    return f"No README.md found in repository {owner}/{repo}."

                if res.status_code == 403:
                    return "GitHub API rate limit reached. Unable to load README at this moment."

                res.raise_for_status()
                text = _clean_unicode(res.text[:2200])
                return f"README for {owner}/{repo}:\n{text}"
        except Exception as exc:
            logger.warning("Error fetching README for %s/%s: %s", owner, repo, exc)
            return f"Error retrieving README for {owner}/{repo}: {str(exc)}"

    @llm.function_tool(
        description=(
            "Inspect the file and directory structure of a candidate's GitHub repository. "
            "Use this to see how their codebase is organized (e.g. 'src/', 'components/', 'api/')."
        )
    )
    async def inspect_repo_file_structure(repo_name: str, path: str = "") -> str:
        """List files and folders in a repository or subdirectory.
        Args:
            repo_name: The name of the repository (e.g. 'InterviewME').
            path: Optional subdirectory path (e.g. '' for root, or 'src', 'apps/api').
        """
        owner, repo = _resolve(repo_name)
        if not owner or not repo:
            return f"Could not determine repository owner for '{repo_name}'."

        clean_path = path.strip("/")
        logger.info("[Tool Call] Inspecting file structure for %s/%s at path '%s'", owner, repo, clean_path)
        url = f"{GITHUB_API}/repos/{owner}/{repo}/contents/{clean_path}" if clean_path else f"{GITHUB_API}/repos/{owner}/{repo}/contents"

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                res = await client.get(url, headers=_get_headers())
                if res.status_code == 404:
                    return f"Path '{path}' not found in repository {owner}/{repo}."
                if res.status_code == 403:
                    return "GitHub API rate limit reached."

                res.raise_for_status()
                items = res.json()
                if not isinstance(items, list):
                    return f"'{path}' is a file, not a directory."

                tree_lines = []
                for item in items[:25]:
                    name = item.get("name", "")
                    kind = "DIR" if item.get("type") == "dir" else "FILE"
                    size = f" ({round(item.get('size', 0) / 1024, 1)} KB)" if kind == "FILE" else ""
                    tree_lines.append(f"[{kind}] {name}{size}")

                return f"Directory listing for {owner}/{repo}/{clean_path}:\n" + "\n".join(tree_lines)
        except Exception as exc:
            return f"Error inspecting structure for {owner}/{repo}: {str(exc)}"

    @llm.function_tool(
        description=(
            "Read the actual code or configuration of a specific file in a candidate's GitHub repository. "
            "Use this to inspect how they implemented authentication, database models, algorithms, or dependencies (e.g. 'package.json', 'models.py', 'main.py')."
        )
    )
    async def read_code_file(repo_name: str, file_path: str) -> str:
        """Read source code of a specific file from a repository.
        Args:
            repo_name: The name of the repository.
            file_path: The path to the file (e.g. 'package.json', 'apps/api/models.py', 'src/auth.ts').
        """
        owner, repo = _resolve(repo_name)
        if not owner or not repo:
            return f"Could not determine repository owner for '{repo_name}'."

        clean_path = file_path.strip("/")
        logger.info("[Tool Call] Reading code file %s/%s:%s", owner, repo, clean_path)
        url = f"{GITHUB_API}/repos/{owner}/{repo}/contents/{clean_path}"
        raw_headers = {**_get_headers(), "Accept": "application/vnd.github.v3.raw"}

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                res = await client.get(url, headers=raw_headers)
                if res.status_code == 404:
                    return f"File '{file_path}' was not found in repository {owner}/{repo}."
                if res.status_code == 403:
                    return "GitHub API rate limit reached."

                res.raise_for_status()
                text = _clean_unicode(res.text[:2400])
                lines_count = len(text.splitlines())
                return f"File {owner}/{repo}/{clean_path} ({lines_count} lines):\n```\n{text}\n```"
        except Exception as exc:
            return f"Error reading file {file_path}: {str(exc)}"

    @llm.function_tool(
        description=(
            "Get languages breakdown, stars, open issues, and topics for a candidate's repository. "
            "Use this to see the primary programming languages and stats of the project."
        )
    )
    async def get_repo_details(repo_name: str) -> str:
        """Get high-level details, stats, and languages breakdown of a repository.
        Args:
            repo_name: The name of the repository.
        """
        owner, repo = _resolve(repo_name)
        if not owner or not repo:
            return f"Could not determine repository owner for '{repo_name}'."

        logger.info("[Tool Call] Fetching repo details for %s/%s", owner, repo)
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                repo_res = await client.get(f"{GITHUB_API}/repos/{owner}/{repo}", headers=_get_headers())
                if repo_res.status_code == 404:
                    return f"Repository {owner}/{repo} was not found."
                repo_res.raise_for_status()
                repo_data = repo_res.json()

                lang_res = await client.get(f"{GITHUB_API}/repos/{owner}/{repo}/languages", headers=_get_headers())
                languages = lang_res.json() if lang_res.status_code == 200 else {}

                total_bytes = sum(languages.values()) or 1
                lang_breakdown = ", ".join(
                    f"{lang} ({round((b / total_bytes) * 100)}%)"
                    for lang, b in list(languages.items())[:5]
                ) or "Not specified"

                return (
                    f"Repository: {owner}/{repo}\n"
                    f"- Description: {repo_data.get('description') or 'No description'}\n"
                    f"- Stars: {repo_data.get('stargazers_count', 0)}, Forks: {repo_data.get('forks_count', 0)}\n"
                    f"- Languages: {lang_breakdown}\n"
                    f"- Topics: {', '.join(repo_data.get('topics') or []) or 'None'}\n"
                    f"- Default Branch: {repo_data.get('default_branch', 'main')}"
                )
        except Exception as exc:
            return f"Error fetching details for {owner}/{repo}: {str(exc)}"

    @llm.function_tool(
        description=(
            "Get recent commit messages from a repository to understand what features, bugfixes, or refactors the candidate recently pushed."
        )
    )
    async def get_recent_commits(repo_name: str) -> str:
        """Get the latest commit messages for a repository.
        Args:
            repo_name: The name of the repository.
        """
        owner, repo = _resolve(repo_name)
        if not owner or not repo:
            return f"Could not determine repository owner for '{repo_name}'."

        logger.info("[Tool Call] Fetching recent commits for %s/%s", owner, repo)
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                res = await client.get(
                    f"{GITHUB_API}/repos/{owner}/{repo}/commits",
                    headers=_get_headers(),
                    params={"per_page": 5},
                )
                if res.status_code == 404:
                    return f"Repository {owner}/{repo} not found."
                res.raise_for_status()
                commits = res.json()

                if not isinstance(commits, list) or not commits:
                    return f"No commits found for {owner}/{repo}."

                lines = []
                for c in commits[:5]:
                    msg = (c.get("commit", {}).get("message") or "").split("\n")[0][:100]
                    author = c.get("commit", {}).get("author", {}).get("name", "Unknown")
                    date = (c.get("commit", {}).get("author", {}).get("date") or "")[:10]
                    lines.append(f"- [{date}] {msg} (by {author})")

                return f"Recent commits for {owner}/{repo}:\n" + "\n".join(lines)
        except Exception as exc:
            return f"Error fetching commits for {owner}/{repo}: {str(exc)}"

    return [
        fetch_repo_readme,
        inspect_repo_file_structure,
        read_code_file,
        get_repo_details,
        get_recent_commits,
    ]
