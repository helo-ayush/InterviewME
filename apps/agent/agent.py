import asyncio
import json
import logging
import os
import re
import time

import httpx
from dotenv import load_dotenv
from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, cli
from livekit.plugins import deepgram, openai, silero

load_dotenv()

logger = logging.getLogger("interviewme-agent")
logging.basicConfig(level=logging.INFO)

API_URL = os.getenv("API_URL", "http://localhost:8000")
INTERNAL_SERVICE_KEY = os.getenv("INTERNAL_SERVICE_KEY", "interviewme-internal-key-dev")


async def fetch_candidate_context(context_id: int) -> dict | None:
    """Fetch candidate profile, resume, and GitHub snapshot from FastAPI internal endpoint."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            headers = {"X-Service-Key": INTERNAL_SERVICE_KEY}
            res = await client.get(f"{API_URL}/internal/candidate-context/{context_id}", headers=headers)
            if res.status_code == 200:
                return res.json()
            logger.warning("Could not fetch candidate context: %s %s", res.status_code, res.text)
    except Exception as exc:
        logger.error("Error fetching candidate context: %s", exc)
    return None


async def finish_interview(context_id: int, transcript: list) -> None:
    """Post final transcript and status to API internal finish endpoint."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            headers = {"X-Service-Key": INTERNAL_SERVICE_KEY}
            payload = {"transcript": transcript, "status": "completed"}
            await client.post(f"{API_URL}/internal/interviews/{context_id}/finish", json=payload, headers=headers)
            logger.info("Successfully reported interview %s completion to API", context_id)
    except Exception as exc:
        logger.error("Failed to report interview finish: %s", exc)


def extract_context_id(ctx: JobContext) -> int | None:
    """Extract interview context ID from job metadata, room metadata, or room name pattern."""
    # 1. From job metadata
    if ctx.job.metadata:
        try:
            data = json.loads(ctx.job.metadata)
            if "context_id" in data:
                return int(data["context_id"])
        except Exception:
            pass

    # 2. From room metadata
    if ctx.room.metadata:
        try:
            data = json.loads(ctx.room.metadata)
            if "context_id" in data:
                return int(data["context_id"])
        except Exception:
            pass

    # 3. From room name pattern: "im-{userId}-{interviewId}"
    match = re.search(r"im-\d+-(\d+)", ctx.room.name)
    if match:
        return int(match.group(1))

    return None


def build_system_prompt(context: dict | None) -> tuple[str, str]:
    """Construct tailored system instructions and initial greeting using candidate context."""
    if not context:
        prompt = (
            "You are a warm, highly professional technical interviewer at InterviewME. "
            "Conduct a structured technical interview in English. "
            "Ask questions ONE AT A TIME. Keep your spoken responses concise, conversational, and natural (1-3 sentences). "
            "Never answer for the candidate. Actively listen and follow up on what they say."
        )
        first_message = (
            "Hello! Welcome to your technical mock interview with InterviewME. "
            "Whenever you're ready, let me know and we'll dive right in."
        )
        return prompt, first_message

    topic = context.get("topic", "General Technical Interview")
    duration_min = round(context.get("duration_sec", 1200) / 60)
    candidate = context.get("candidate", {})
    cand_name = candidate.get("name", "Candidate")
    cand_role = candidate.get("role", "Software Engineer")
    cand_level = candidate.get("experience_level", "Junior")
    cand_skills = ", ".join(candidate.get("skills", [])) or "Standard software development skills"

    github_data = context.get("github") or {}
    github_login = github_data.get("login")
    github_stack = ", ".join(github_data.get("tech_stack", []))
    repos = github_data.get("repos", [])
    repo_bullets = "\n".join(
        f"- {r.get('name')}: {r.get('description') or 'No description'} (Primary language: {r.get('language') or 'Various'})"
        for r in repos[:6]
    )

    resume_data = context.get("resume") or {}
    resume_summary = resume_data.get("summary") or ""
    resume_text = (resume_data.get("text") or "")[:1500]

    github_section = f"- GitHub Account: @{github_login} (Detected stack: {github_stack})" if github_login else ""
    repos_section = f"- Candidate Repositories:\n{repo_bullets}" if repo_bullets else ""
    summary_section = f"- Resume Summary: {resume_summary}" if resume_summary else ""
    highlights_section = f"- Resume Highlights: {resume_text}" if resume_text else ""

    context_lines = [
        f"- Skills: {cand_skills}",
        github_section,
        repos_section,
        summary_section,
        highlights_section,
    ]
    context_block = "\n".join(line for line in context_lines if line)

    prompt = f"""[IDENTITY]
You are a warm, sharp, and highly professional technical interviewer at InterviewME.
You are conducting a live {duration_min}-minute mock interview on the topic: "{topic}".
Candidate: {cand_name} (Targeting {cand_role}, Experience Level: {cand_level}).

[INTERVIEW RULES]
1. Ask exactly ONE question at a time.
2. Spoken output must be natural, conversational, and concise (1-3 sentences max). Never monologue or recite long bullet points aloud.
3. Never answer the question for the candidate or talk over them.
4. If the candidate answers well, validate briefly ("Great explanation", "Makes sense") and probe deeper or move forward.
5. If the candidate struggles, offer a gentle hint or ask a clarifying question.

[CANDIDATE CONTEXT]
{context_block}

[INTERVIEW FLOW]
1. Warm Welcome & Warm-up (1-2 questions)
2. Technical Fundamentals on "{topic}"
3. Deep-Dive Problem Solving & Practical Scenarios
4. Project Probing (Ask about their real projects/repos listed in their context)
5. Wrap-Up & Closing Remarks
"""
    first_name = cand_name.split()[0] if cand_name else "there"
    first_message = (
        f"Hi {first_name}, welcome to your InterviewME session! Today we'll focus on {topic}. "
        "Whenever you're ready, let me know and we'll get started with a quick introduction."
    )
    return prompt, first_message


class InterviewAgent(Agent):
    def __init__(self, instructions: str) -> None:
        super().__init__(instructions=instructions)


async def entrypoint(ctx: JobContext) -> None:
    logger.info("Connecting to room: %s", ctx.room.name)
    await ctx.connect()

    context_id = extract_context_id(ctx)
    logger.info("Resolved context ID: %s", context_id)

    context = None
    if context_id:
        context = await fetch_candidate_context(context_id)
        logger.info("Loaded candidate context: %s", bool(context))

    instructions, first_message = build_system_prompt(context)

    # Groq via OpenAI-compatible endpoint
    groq_api_key = os.getenv("GROQ_API_KEY")
    groq_model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
    llm = openai.LLM(
        model=groq_model,
        base_url="https://api.groq.com/openai/v1",
        api_key=groq_api_key,
    )

    session = AgentSession(
        vad=silero.VAD.load(),
        stt=deepgram.STT(model="nova-3"),
        tts=deepgram.TTS(model="aura-2-angus-en"),
        llm=llm,
    )

    transcript_history: list[dict] = []

    async def broadcast_transcript(msg: dict) -> None:
        try:
            if ctx.room.isconnected() and ctx.room.local_participant:
                await ctx.room.local_participant.publish_data(
                    payload=json.dumps(msg),
                    topic="transcription",
                )
        except Exception as e:
            logger.debug("Failed to broadcast transcript: %s", e)

    @session.on("user_input_transcribed")
    def on_user_input(ev):
        if ev.transcript and ev.transcript.strip():
            msg = {
                "type": "transcript",
                "id": ev.item_id or f"cand-live-{time.time()}",
                "role": "candidate",
                "text": ev.transcript,
                "final": ev.is_final,
            }
            asyncio.create_task(broadcast_transcript(msg))

    @session.on("conversation_item_added")
    def on_conversation_item(ev):
        item = ev.item
        if hasattr(item, "role") and hasattr(item, "text_content"):
            role = "agent" if item.role == "assistant" else "candidate"
            text = item.text_content
            if text and text.strip():
                logger.info("Transcript [%s]: %s", role, text)
                transcript_history.append({
                    "role": role,
                    "text": text,
                    "timestamp": time.time(),
                })
                msg = {
                    "type": "transcript",
                    "id": getattr(item, "id", None) or f"{role}-{time.time()}",
                    "role": role,
                    "text": text,
                    "final": True,
                }
                asyncio.create_task(broadcast_transcript(msg))

    @session.on("close")
    def on_close(ev):
        logger.info("Interview session closed: %s", ev)
        if context_id and transcript_history:
            asyncio.create_task(finish_interview(context_id, transcript_history))

    logger.info("Waiting for candidate participant to join room...")
    await ctx.wait_for_participant()
    logger.info("Candidate participant joined room. Starting AgentSession...")

    await session.start(
        agent=InterviewAgent(instructions),
        room=ctx.room,
    )

    # Initial greeting to candidate
    logger.info("Speaking greeting: %s", first_message)
    transcript_history.append({
        "role": "agent",
        "text": first_message,
        "timestamp": time.time(),
    })
    await broadcast_transcript({
        "type": "transcript",
        "id": "agent-greeting",
        "role": "agent",
        "text": first_message,
        "final": True,
    })
    session.say(first_message, add_to_chat_ctx=True)


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
