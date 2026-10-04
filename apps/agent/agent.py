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

from coding_tools import CodingSessionState, create_coding_tools
from github_tools import create_github_tools

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


async def finish_interview(context_id: int, transcript: list, code_workspace: dict | None = None) -> None:
    """Post final transcript, code workspace, and status to API internal finish endpoint."""
    headers = {"X-Service-Key": INTERNAL_SERVICE_KEY}
    payload = {
        "transcript": transcript,
        "status": "completed",
        "code_workspace": code_workspace or {},
    }
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                res = await client.post(
                    f"{API_URL}/internal/interviews/{context_id}/finish", json=payload, headers=headers
                )
                if res.status_code == 200:
                    logger.info("Successfully reported interview %s completion to API", context_id)
                    return
                logger.warning("Finish report attempt %d: %s %s", attempt + 1, res.status_code, res.text[:200])
        except Exception as exc:
            logger.error("Failed to report interview finish (attempt %d): %s", attempt + 1, exc)
        await asyncio.sleep(1.5 * (attempt + 1))


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

    prompt = f"""[SESSION]
Live {duration_min}-minute mock interview on "{topic}".
Candidate: {cand_name} (Targeting {cand_role}, Level: {cand_level}).

[IDENTITY — HUMAN PAIR-PROGRAMMER]
You are a warm senior engineer sitting next to the candidate, not a quiz robot.
Voice-first: everything important must work by VOICE alone. Buttons exist only as fallback.
Style: 1-2 short sentences per turn, natural fillers sparingly ("Got it", "Makes sense", "Let's dig in").
Use the candidate's first name occasionally, never every sentence. Celebrate progress, normalize struggle.
Bridge lines BEFORE every tool call (keeps latency <1s feeling): "Let me look at your code…", "One sec, pulling that up…", "Give me a moment with your editor…".
Never monologue, never recite code/tests aloud, never announce timers or seconds.

[VOICE COMMANDS — ALWAYS HONOR BY VOICE]
Completion (call grab_candidate_code IMMEDIATELY): "I'm done", "finished", "I fixed it", "check my code",
"review this", "look at this", "can you check", "what do you think", or any speech after a work pause.
Help/confusion (call give_coding_hint OR explain path): "hint", "stuck", "confused", "don't understand",
"don't get it", "help", "what should I do", "explain".
Live edit requests (call get_code_with_line_numbers THEN highlight_code_lines or edit_candidate_code):
"can you fix/change/replace/write/add/remove …", "type … for me", "show me on line …", "line X …".
NEVER edit unless they explicitly asked. Edits are small (<=12 lines), then ask "want to take it from here?".
Skip (call cancel_or_skip_task): "skip", "next question", "different one", "move on", "don't want this".

[INTERVIEW RULES]
1. Exactly ONE question or action at a time.
2. Spoken output: 1-3 sentences max, conversational. No bullet recitals.
3. Never answer for them; never talk over them. If they interrupt, stop and listen.
4. Validate briefly then probe deeper ("Nice — why did you pick that approach?").
5. Struggling → Socratic hint, not solution. Offer to pair: "Want to debug this one together?"

[CANDIDATE CONTEXT]
{context_block}

[GITHUB CODEBASE INVESTIGATION TOOLS]
You are equipped with live tools to inspect the candidate's real GitHub repositories during the interview:
- `fetch_repo_readme(repo_name)`: Read the project architecture, features, and tech stack.
- `inspect_repo_file_structure(repo_name, path)`: Look into directory layouts (e.g. `src`, `apps/api`, `components`).
- `read_code_file(repo_name, file_path)`: Examine actual source code files (e.g. `package.json`, auth handlers, database models).
- `get_repo_details(repo_name)`: Get tech stack percentages, stars, and repository statistics.
- `get_recent_commits(repo_name)`: Check recent commits and development activity.

When discussing their projects (especially in Stage 4), proactively call these tools to inspect their actual code. Then use your findings to ask specific, grounded questions (e.g. "I see in your repository that you structured the backend with FastAPI routers and JWT authentication - what led you to that design?"). Keep your spoken question concise and conversational - never read raw code or large file dumps aloud.

[COLLABORATIVE MONACO CODE EDITOR — VOICE-FIRST, NO COUNTDOWN]
The candidate sees a calm editor (NO timer displayed anywhere). All pacing is YOUR invisible job.
You have 8 coding tools: `present_skill_challenge`, `present_coding_task` (custom only),
`get_code_with_line_numbers`, `highlight_code_lines`, `edit_candidate_code`,
`give_coding_hint`, `grab_candidate_code`, `cancel_or_skip_task`.

STRICT CODING RULES:
1. ALWAYS use `present_skill_challenge` for coding (never invent problems).
   Map topic -> skill: DSA/algorithms->'dsa', Web/React->'web', GenAI/LLM/RAG->'genai',
   ML/AI->'ml', System Design->'system', SQL/databases->'sql'. Level: Intern/Junior=1, Mid=2, Senior=3.
2. ONE task at a time. Present in 1-2 warm sentences: title + skill + "take your time, think aloud,
   just say I'm done when you're ready". NEVER mention seconds, limits, or countdowns.
3. While they work: stay quiet but present. Background coaching (SYSTEM messages) will tell you elapsed time
   and silence — translate those into human check-ins ("How's it shaping up?", "Want a nudge or want to keep going?").
   Two unanswered check-ins in a row → wrap the task kindly and fall back to verbal questions.
4. COMPLETION — call `grab_candidate_code` IMMEDIATELY on done-signals or speech after a work pause.
   Ground your 1-3 sentence feedback in the tool's static analysis. Then: strong solve → ONE follow-up or harder
   task; weak solve → hint, easier task, or graceful skip.
5. CONFUSION ("I don't understand line X", "what does this do") → FIRST call `get_code_with_line_numbers`,
   THEN `highlight_code_lines` and explain that range aloud in plain words. Only call `edit_candidate_code`
   if they EXPLICITLY ask you to write/fix it. Never edit uninvited.
6. Skip/reject → acknowledge warmly, present an easier or adjacent challenge, keep momentum.

[INTERVIEW FLOW]
1. Warm Welcome & Warm-up (1-2 questions)
2. Technical Fundamentals on "{topic}"
3. Deep-Dive Problem Solving & Monaco Live Coding / Bug Hunting (Use `present_coding_task` & `grab_candidate_code`)
4. Project Probing & Code Architecture (Leverage GitHub tools to explore their actual repositories)
5. Wrap-Up & Closing Remarks
"""
    first_name = cand_name.split()[0] if cand_name else "there"
    first_message = (
        f"Hi {first_name}, welcome to your InterviewME session! Today we'll focus on {topic}. "
        "Whenever you're ready, let me know and we'll get started with a quick introduction."
    )
    return prompt, first_message


class InterviewAgent(Agent):
    def __init__(self, instructions: str, tools: list | None = None) -> None:
        super().__init__(instructions=instructions, tools=tools or [])


async def entrypoint(ctx: JobContext) -> None:
    logger.info("Connecting to room: %s", ctx.room.name)
    await ctx.connect()

    context_id = extract_context_id(ctx)
    logger.info("Resolved context ID: %s", context_id)

    context = None
    if context_id:
        context = await fetch_candidate_context(context_id)
        logger.info("Loaded candidate context: %s", bool(context))

    github_login = None
    if context and context.get("github"):
        github_login = context["github"].get("login")

    coding_state = CodingSessionState()
    coding_tools = create_coding_tools(ctx.room, coding_state)
    github_tools = create_github_tools(default_owner=github_login)
    all_tools = [*github_tools, *coding_tools]
    logger.info("Registered %d GitHub tools and %d Coding tools (default owner: %s)", len(github_tools), len(coding_tools), github_login or "None")

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
        tts=deepgram.TTS(model=os.getenv("DEEPGRAM_TTS_MODEL", "aura-2-asteria-en")),
        llm=llm,
        # Human turn-taking: let the candidate interrupt naturally, wait briefly
        # for them to finish before responding (no robotic cut-offs).
        allow_interruptions=True,
        min_endpointing_delay=0.4,
        max_endpointing_delay=2.0,
        min_interruption_duration=0.4,
        min_interruption_words=2,
        user_away_timeout=15.0,
    )

    transcript_history: list[dict] = []
    watchdog: asyncio.Task | None = None
    coding_monitor: asyncio.Task | None = None

    # Voice-intent safety net: if the LLM misses a voice command, catch it here.
    # (The system prompt already instructs tool calls; this guarantees "I'm done"
    # by voice ALWAYS leads to a review even if the model hesitates.)
    DONE_RE = re.compile(
        r"\b(i['’]m\s+done|i\s+finished|i\s+fixed\s+it|check\s+(my|this|the)\s+code|"
        r"review\s+(my|this)|look\s+at\s+(my|this)|can\s+you\s+check|what\s+do\s+you\s+think|"
        r"i\s+am\s+done|that\s+should\s+do\s+it|try\s+this|here\s+it\s+is)\b",
        re.IGNORECASE,
    )
    HINT_RE = re.compile(
        r"\b(hint|stuck|confus|don['’]t\s+(understand|get\s+it|know)|help|"
        r"what\s+should\s+i\s+do|explain|walk\s+me\s+through|i\s+don['’]t\s+get)\b",
        re.IGNORECASE,
    )
    SKIP_RE = re.compile(
        r"\b(skip(\s+this)?|next\s+question|different\s+(one|question|problem)|move\s+on|"
        r"don['’]t\s+want\s+this|too\s+hard)\b",
        re.IGNORECASE,
    )
    last_auto_trigger: dict[str, float] = {}

    def _should_autotrigger(kind: str, cooldown: float = 12.0) -> bool:
        now = time.time()
        if now - last_auto_trigger.get(kind, 0.0) < cooldown:
            return False
        last_auto_trigger[kind] = now
        return True

    async def broadcast_transcript(msg: dict) -> None:
        try:
            local = getattr(ctx.room, "local_participant", None)
            connected = ctx.room.isconnected() if hasattr(ctx.room, "isconnected") else True
            if callable(connected):
                connected = ctx.room.isconnected()
            if connected and local:
                await local.publish_data(
                    payload=json.dumps(msg).encode("utf-8"),
                    topic="transcription",
                )
        except Exception as e:
            logger.debug("Failed to broadcast transcript: %s", e)

    # Listen to data packets from candidate browser (Monaco code sync and actions)
    @ctx.room.on("data_received")
    def on_data_received(dp):
        try:
            topic = dp.topic or ""
            raw = dp.data
            if isinstance(raw, (bytes, bytearray)):
                text_data = bytes(raw).decode("utf-8")
            else:
                text_data = str(raw)
            try:
                payload = json.loads(text_data)
            except json.JSONDecodeError:
                logger.debug("Ignoring non-JSON data on topic '%s'", topic)
                return
            if not isinstance(payload, dict):
                return

            if topic == "code_sync":
                code = payload.get("code", "")
                lang = payload.get("language", "python")
                coding_state.set_code(code, lang, task_id=payload.get("taskId"))
            elif topic == "code_action":
                action = payload.get("type")
                if action == "task_rejected":
                    task_id = payload.get("taskId", "")
                    coding_state.record_rejection(task_id, payload.get("reason", "Candidate skipped"))
                    logger.info("Candidate rejected coding task: %s", task_id)
                    asyncio.create_task(session.say(
                        "No problem at all! Let's skip that challenge and move on.",
                        add_to_chat_ctx=True,
                    ))
                elif action == "hint_requested":
                    task_id = payload.get("taskId", "")
                    hint_code = payload.get("code")
                    if hint_code is not None:
                        coding_state.set_code(hint_code, payload.get("language") or "python", task_id=task_id)
                    coding_state.mark_voice_activity()
                    logger.info("Candidate requested hint for task: %s", task_id)
                    async def _give_hint():
                        try:
                            await session.generate_reply(
                                instructions=(
                                    "The candidate clicked the Hint button in the code editor. "
                                    "Call `give_coding_hint` now and speak exactly one progressive hint aloud. "
                                    "Do not reveal the full solution."
                                )
                            )
                        except Exception as exc:
                            logger.debug("generate_reply for hint failed: %s", exc)
                    asyncio.create_task(_give_hint())
                elif action == "snapshot_request":
                    # Frontend reconnected mid-task and needs the current state re-sent.
                    active = coding_state.active_task
                    logger.info("Snapshot requested (task: %s)", (active or {}).get("taskId"))
                    async def _resend_snapshot():
                        try:
                            if active and ctx.room.local_participant:
                                await ctx.room.local_participant.publish_data(
                                    payload=json.dumps(active).encode("utf-8"),
                                    topic="code_task",
                                    reliable=True,
                                )
                        except Exception as exc:
                            logger.debug("Snapshot resend failed: %s", exc)
                    asyncio.create_task(_resend_snapshot())
                elif action == "code_submitted":
                    task_id = payload.get("taskId", "")
                    submitted_code = payload.get("code")
                    submitted_lang = payload.get("language")
                    if submitted_code is not None:
                        coding_state.set_code(submitted_code, submitted_lang or "python", task_id=task_id)
                    # Atomically complete so grab_candidate_code won't double-broadcast
                    completed = coding_state.complete_task(task_id or None)
                    broadcast_id = task_id or (completed or {}).get("taskId", "")
                    logger.info("Candidate submitted code for task: %s (%d chars)", broadcast_id, len(coding_state.candidate_code))
                    # Broadcast task_completed to ensure frontend stops countdown immediately
                    async def _ack_and_review():
                        try:
                            if broadcast_id and ctx.room.local_participant:
                                await ctx.room.local_participant.publish_data(
                                    payload=json.dumps({"type": "task_completed", "taskId": broadcast_id}).encode("utf-8"),
                                    topic="code_task",
                                    reliable=True,
                                )
                        except Exception as exc:
                            logger.debug("Failed to ack task_completed: %s", exc)
                        try:
                            await session.generate_reply(
                                instructions=(
                                    "The candidate has just submitted their solution in the Monaco Code Editor. "
                                    "Call `grab_candidate_code` right now to inspect what they wrote, and provide constructive feedback aloud."
                                )
                            )
                        except Exception as exc:
                            logger.debug("generate_reply after submit failed: %s", exc)
                    asyncio.create_task(_ack_and_review())
        except Exception as exc:
            logger.debug("Error processing data channel packet: %s", exc)

    @session.on("user_input_transcribed")
    def on_user_input(ev):
        text = (ev.transcript or "").strip()
        if not text:
            return
        if not ev.is_final:
            # Stream in-progress speech for live visual update only (no new bubble)
            asyncio.create_task(broadcast_transcript({
                "type": "interim",
                "role": "candidate",
                "text": text,
            }))
        else:
            # Candidate finished sentence — marks voice activity for the invisible timer
            coding_state.mark_voice_activity()
            turn_id = ev.item_id or f"cand-{int(time.time() * 1000)}"
            asyncio.create_task(broadcast_transcript({
                "type": "transcript",
                "id": turn_id,
                "role": "candidate",
                "text": text,
                "final": True,
            }))
            # Safety net: voice "I'm done" / hint / skip ALWAYS triggers even if the LLM stalls.
            active = coding_state.active_task
            if active:
                lowered = text.lower()
                if DONE_RE.search(lowered) and _should_autotrigger("done"):
                    async def _auto_grab():
                        try:
                            await session.generate_reply(
                                instructions=(
                                    "SYSTEM SAFETY-NET: the candidate just said they are DONE by voice "
                                    f"(heard: '{text[:120]}'). Call `grab_candidate_code` RIGHT NOW and give "
                                    "1-3 sentences of warm spoken feedback. Do not ask them to click anything."
                                )
                            )
                        except Exception as exc:
                            logger.debug("auto-grab failed: %s", exc)
                    asyncio.create_task(_auto_grab())
                elif HINT_RE.search(lowered) and _should_autotrigger("hint"):
                    async def _auto_hint():
                        try:
                            await session.generate_reply(
                                instructions=(
                                    "SYSTEM SAFETY-NET: the candidate asked for HELP by voice "
                                    f"(heard: '{text[:120]}'). If they seem confused about code, first call "
                                    "`get_code_with_line_numbers`, then `highlight_code_lines` + explain, or "
                                    "`give_coding_hint` for a progressive hint. One step at a time."
                                )
                            )
                        except Exception as exc:
                            logger.debug("auto-hint failed: %s", exc)
                    asyncio.create_task(_auto_hint())
                elif SKIP_RE.search(lowered) and _should_autotrigger("skip"):
                    async def _auto_skip():
                        try:
                            await session.generate_reply(
                                instructions=(
                                    "SYSTEM SAFETY-NET: the candidate wants to SKIP by voice "
                                    f"(heard: '{text[:120]}'). Call `cancel_or_skip_task`, acknowledge warmly, "
                                    "and move to an easier challenge or a verbal question."
                                )
                            )
                        except Exception as exc:
                            logger.debug("auto-skip failed: %s", exc)
                    asyncio.create_task(_auto_skip())

    @session.on("conversation_item_added")
    def on_conversation_item(ev):
        item = ev.item
        if hasattr(item, "role") and hasattr(item, "text_content"):
            role = "agent" if item.role == "assistant" else "candidate"
            text = (item.text_content or "").strip()
            if text:
                logger.info("Transcript [%s]: %s", role, text)
                if role == "candidate":
                    coding_state.mark_voice_activity()
                transcript_history.append({
                    "role": role,
                    "text": text,
                    "timestamp": time.time(),
                })
                # Broadcast agent spoken replies (candidate final is already broadcast on user_input_transcribed)
                if role == "agent":
                    asyncio.create_task(broadcast_transcript({
                        "type": "transcript",
                        "id": getattr(item, "id", None) or f"agent-{int(time.time() * 1000)}",
                        "role": "agent",
                        "text": text,
                        "final": True,
                    }))

    @session.on("close")
    def on_close(ev):
        logger.info("Interview session closed: %s", ev)
        for task_handle in (watchdog, coding_monitor):
            try:
                if task_handle is not None:
                    task_handle.cancel()
            except Exception:
                pass
        if context_id and transcript_history:
            code_workspace = {
                "code": coding_state.candidate_code,
                "language": coding_state.candidate_language,
                "task_history": coding_state.task_history,
                "rejected_tasks": coding_state.rejected_tasks,
                "patches_applied": coding_state.patches_applied[-10:],
                "hints_given": coding_state.hints_given,
            }
            asyncio.create_task(finish_interview(context_id, transcript_history, code_workspace))

    logger.info("Waiting for candidate participant to join room...")
    try:
        await asyncio.wait_for(ctx.wait_for_participant(), timeout=120)
    except asyncio.TimeoutError:
        logger.warning("No participant joined within 120s; shutting down job for room %s", ctx.room.name)
        return
    logger.info("Candidate participant joined room. Starting AgentSession...")

    await session.start(
        agent=InterviewAgent(instructions, tools=all_tools),
        room=ctx.room,
    )

    # Pacing watchdog: nudge the LLM through coding + wrap-up based on duration
    duration_sec = 1200
    try:
        duration_sec = int((context or {}).get("duration_sec", 1200))
    except (TypeError, ValueError):
        pass

    async def _pacing_watchdog():
        try:
            # Nudge to live-coding around 40% if no task has been presented yet
            await asyncio.sleep(duration_sec * 0.40)
            if not coding_state.task_history:
                try:
                    await session.generate_reply(
                        instructions=(
                            "SYSTEM PACING (40% elapsed): move to live coding NOW. "
                            "Call `present_skill_challenge` matched to the interview topic and candidate level, "
                            "then introduce it in 1-2 warm sentences. Never mention time."
                        )
                    )
                except Exception as exc:
                    logger.debug("Pacing nudge 40%% failed: %s", exc)
            # Wrap-up warning at 85%
            await asyncio.sleep(duration_sec * 0.45)
            try:
                await session.generate_reply(
                    instructions=(
                        "SYSTEM PACING (85% elapsed): begin wrap-up. If a coding task is active, "
                        "call `grab_candidate_code` for final feedback, then ask one closing question "
                        "and thank the candidate."
                    )
                )
            except Exception as exc:
                logger.debug("Pacing nudge 85%% failed: %s", exc)
        except asyncio.CancelledError:
            pass

    async def _coding_monitor():
        """Invisible per-task timer: gentle human check-ins, then verbal fallback.

        The candidate never sees time. This loop translates elapsed/silence into
        coaching instructions. Two consecutive unanswered check-ins -> gracefully
        close the task and return to verbal questions (no pressure, no countdown).
        """
        try:
            while True:
                await asyncio.sleep(10)
                active = coding_state.active_task
                if not active:
                    continue
                limit = max(120, coding_state.soft_limit_sec)
                elapsed = coding_state.elapsed_since_present()
                frac = elapsed / limit if limit else 0
                silence = time.time() - max(coding_state.last_voice_at, coding_state.last_code_at)
                code_len = len(coding_state.candidate_code or "")

                async def _coach(kind: str, text: str) -> None:
                    if kind in coding_state.nudges_sent:
                        return
                    coding_state.nudges_sent.add(kind)
                    coding_state.last_nudge_voice_mark = coding_state.last_voice_at
                    coding_state.last_nudge_code_mark = coding_state.candidate_code or ""
                    try:
                        await session.generate_reply(instructions=text)
                    except Exception as exc:
                        logger.debug("Coding nudge %s failed: %s", kind, exc)

                # Track whether the previous check-in got ANY response (voice or code edit)
                if "check1" in coding_state.nudges_sent or "check2" in coding_state.nudges_sent:
                    responded = (
                        coding_state.last_voice_at > coding_state.last_nudge_voice_mark
                        or (coding_state.candidate_code or "") != coding_state.last_nudge_code_mark
                    )
                    if not responded and silence > 45:
                        coding_state.unanswered_checkins += 1
                    elif responded and coding_state.unanswered_checkins > 0:
                        coding_state.unanswered_checkins = 0

                if coding_state.unanswered_checkins >= 2:
                    coding_state.unanswered_checkins = 0
                    try:
                        await session.generate_reply(
                            instructions=(
                                "SYSTEM COACHING: the candidate has not responded to your last two check-ins "
                                "(no speech, no code change for a while). Kindly close this task: call "
                                "`grab_candidate_code` for whatever is there (or `cancel_or_skip_task` if empty), "
                                "give brief encouragement, and fall back to a verbal question. "
                                "Never scold, never mention timers."
                            )
                        )
                    except Exception as exc:
                        logger.debug("Fallback nudge failed: %s", exc)
                    continue

                if frac >= 1.15 and "wrap" not in coding_state.nudges_sent:
                    mins = int(elapsed // 60)
                    await _coach(
                        "wrap",
                        f"SYSTEM COACHING: ~{mins} min on '{active.get('title')}' (budget ~{limit // 60} min, "
                        f"{code_len} chars written, {silence:.0f}s since last activity). Wrap kindly: call "
                        "`grab_candidate_code` now, give 1-2 sentences of feedback, then move to a verbal "
                        "question. Never announce time remaining."
                    )
                elif frac >= 0.9 and "almost" not in coding_state.nudges_sent:
                    await _coach(
                        "almost",
                        f"SYSTEM COACHING: well into '{active.get('title')}' ({code_len} chars, "
                        f"{silence:.0f}s quiet). Check in warmly in ONE sentence "
                        "('How's it shaping up — want to keep going or talk it through?'). "
                        "If they answer, adapt; if silence continues, wait for the wrap instruction."
                    )
                elif frac >= 0.6 and "mid" not in coding_state.nudges_sent and silence > 40:
                    await _coach(
                        "mid",
                        f"SYSTEM COACHING: midway through '{active.get('title')}' with {silence:.0f}s of quiet. "
                        "Offer ONE gentle nudge ('Want a small nudge, or are you on a trail?'). "
                        "Call `give_coding_hint` only if they say yes or sound stuck."
                    )
                elif frac >= 0.3 and "early" not in coding_state.nudges_sent and silence > 60:
                    await _coach(
                        "early",
                        f"SYSTEM COACHING: '{active.get('title')}' started a bit ago, {silence:.0f}s quiet. "
                        "Say ONE warm line ('How's the approach feeling so far?'). Keep it light."
                    )
        except asyncio.CancelledError:
            pass

    watchdog = asyncio.create_task(_pacing_watchdog())
    coding_monitor = asyncio.create_task(_coding_monitor())

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
    try:
        await session.say(first_message, add_to_chat_ctx=True)
    except Exception as exc:
        logger.debug("Initial greeting say() failed: %s", exc)


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
