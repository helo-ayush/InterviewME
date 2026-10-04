import json
import logging
import time
from livekit import rtc
from livekit.agents import llm

from coding_challenges import (
    analyze_submission,
    challenge_brief,
    normalize_skill,
    pick_challenge,
)

logger = logging.getLogger("interviewme.agent.coding_tools")


class CodingSessionState:
    """Maintains active coding challenge state and real-time candidate code buffer.

    Voice-first invisible-timer model:
    - The candidate NEVER sees a countdown. Timing lives here only.
    - presented_at / soft_limit_sec drive gentle agent check-ins, not UI pressure.
    - last_voice_at / last_code_at drive silence detection + verbal fallback.
    """

    def __init__(self) -> None:
        self.active_task: dict | None = None
        self.candidate_code: str = ""
        self.candidate_language: str = "python"
        self.last_sync_timestamp: float = 0.0
        self.last_sync_task_id: str | None = None
        self.task_history: list[dict] = []
        self.rejected_tasks: list[dict] = []
        self.hints_given: dict[str, int] = {}
        self.last_analysis: dict | None = None
        self.completed_task_ids: set[str] = set()
        # Invisible pacing (agent-side only, never rendered as countdown)
        self.presented_at: float | None = None
        self.soft_limit_sec: int = 300
        self.nudges_sent: set[str] = set()
        self.last_voice_at: float = time.time()
        self.last_code_at: float = time.time()
        self.last_code_len: int = 0
        self.last_nudge_voice_mark: float = 0.0
        self.last_nudge_code_mark: str = ""
        self.unanswered_checkins: int = 0
        self.patch_seq: int = 0
        self.patches_applied: list[dict] = []

    def set_code(self, code: str, language: str = "python", task_id: str | None = None) -> None:
        prev = self.candidate_code
        self.candidate_code = code
        self.candidate_language = language or "python"
        self.last_sync_timestamp = time.time()
        if task_id:
            self.last_sync_task_id = task_id
        # Only count genuine edits as activity (seed/identical syncs don't reset silence)
        if code != prev:
            self.last_code_at = time.time()
            self.last_code_len = len(code)

    def mark_voice_activity(self) -> None:
        self.last_voice_at = time.time()

    def elapsed_since_present(self) -> float:
        if not self.presented_at:
            return 0.0
        return max(0.0, time.time() - self.presented_at)

    def silence_sec(self) -> float:
        return max(0.0, time.time() - max(self.last_voice_at, self.last_code_at))

    def start_task(self, task_payload: dict) -> dict | None:
        """Begin a new task, auto-closing any stale active task. Returns the stale task if any."""
        stale = self.active_task
        if stale and stale.get("taskId") not in self.completed_task_ids:
            self.task_history.append({**stale, "auto_superseded": True})
        self.active_task = task_payload
        self.task_history.append(task_payload)
        now = time.time()
        self.presented_at = now
        self.last_voice_at = now
        self.last_code_at = now
        self.nudges_sent = set()
        self.unanswered_checkins = 0
        self.last_nudge_voice_mark = now
        self.last_nudge_code_mark = task_payload.get("starterCode", "")
        try:
            self.soft_limit_sec = int(task_payload.get("timeLimitSec", 300))
        except (TypeError, ValueError):
            self.soft_limit_sec = 300
        self.set_code(task_payload.get("starterCode", ""), task_payload.get("language", "python"))
        # set_code with identical starter counts as non-activity; reset to presentation time
        self.last_code_at = now
        self.last_code_len = len(task_payload.get("starterCode", ""))
        self.hints_given[task_payload["taskId"]] = 0
        return stale

    def complete_task(self, task_id: str | None = None) -> dict | None:
        """Atomically clear the active task. Returns the completed task or None if already cleared."""
        active = self.active_task
        if not active:
            return None
        if task_id and active.get("taskId") != task_id:
            return None
        active["completedAt"] = time.time()
        active["elapsedSec"] = round(self.elapsed_since_present(), 1)
        active["hintsUsed"] = self.hints_given.get(active.get("taskId", ""), 0)
        self.active_task = None
        self.presented_at = None
        self.nudges_sent = set()
        self.unanswered_checkins = 0
        self.completed_task_ids.add(active.get("taskId", ""))
        return active

    def record_rejection(self, task_id: str, reason: str = "") -> None:
        self.rejected_tasks.append({
            "task_id": task_id,
            "rejected_at": time.time(),
            "reason": reason,
        })
        if self.active_task and (not task_id or self.active_task.get("taskId") == task_id):
            self.completed_task_ids.add(self.active_task.get("taskId", ""))
            self.active_task = None

    def challenge_for_task(self, task: dict | None) -> dict | None:
        if not task:
            return None
        ref = task.get("challengeRef")
        if isinstance(ref, dict) and ref.get("id"):
            from coding_challenges import CHALLENGES
            for c in CHALLENGES:
                if c["id"] == ref["id"]:
                    return c
        return None


def _normalize_lang(language: str | None) -> str:
    clean_lang = (language or "python").lower().strip()
    aliases = {
        "py": "python", "python3": "python",
        "js": "javascript", "node": "javascript", "jsx": "javascript",
        "ts": "typescript", "tsx": "typescript",
        "c++": "cpp", "cplusplus": "cpp",
    }
    return aliases.get(clean_lang, clean_lang)


def apply_line_patch(current_code: str, start_line: int, end_line: int, new_text: str) -> tuple[str, int]:
    """Apply a 1-indexed inclusive line replacement. Returns (new_code, lines_after)."""
    lines = current_code.splitlines() if current_code else []
    total = len(lines)
    s = max(1, int(start_line))
    e = max(s, int(end_line))
    # Clamp to allow appending just past the end
    s = min(s, total + 1)
    e = min(e, max(total, s))
    new_lines = (new_text or "").splitlines()
    before = lines[: s - 1] if total else []
    after = lines[e:] if e <= total else []
    merged = before + new_lines + after
    return "\n".join(merged) + ("\n" if merged else ""), len(merged)


def numbered_code(code: str, start: int = 1, limit: int = 200) -> str:
    lines = (code or "").splitlines()
    out = []
    for i, ln in enumerate(lines[:limit], start=start):
        out.append(f"{i:>4} | {ln}")
    if len(lines) > limit:
        out.append(f"... ({len(lines) - limit} more lines)")
    return "\n".join(out) if out else "(empty editor)"


def create_coding_tools(
    room: rtc.Room,
    state: CodingSessionState,
) -> list[llm.FunctionTool]:
    """Factory creating LiveKit function tools for collaborative Monaco code interaction."""

    async def _broadcast(topic: str, payload: dict) -> bool:
        try:
            local = getattr(room, "local_participant", None)
            connected = room.isconnected() if hasattr(room, "isconnected") else True
            if callable(connected):
                connected = room.isconnected()
            if connected and local:
                data = json.dumps(payload).encode("utf-8")
                await local.publish_data(payload=data, topic=topic, reliable=True)
                return True
            logger.debug("Skipping broadcast on '%s': room not connected", topic)
        except Exception as exc:
            logger.warning("Failed to broadcast on topic '%s': %s", topic, exc)
        return False

    @llm.function_tool(
        description=(
            "Load a coding challenge or a buggy code snippet directly into the candidate's browser Monaco Editor. "
            "PREFER present_skill_challenge for vetted skill-based questions. Use this freeform tool only for "
            "custom follow-ups. Specify title, problem description, starter or buggy code, language, "
            "time_limit_sec (default 300s = 5 minutes), and mode ('write_code' or 'fix_bug')."
        )
    )
    async def present_coding_task(
        title: str,
        description: str,
        language: str = "python",
        starter_code: str = "",
        time_limit_sec: int = 300,
        mode: str = "write_code",
    ) -> str:
        """Present a coding challenge in the candidate's Monaco Editor with a countdown timer.
        Args:
            title: Short, clear title of the challenge (e.g. 'Two Sum', 'LRU Cache Eviction Bug').
            description: Concise problem statement, constraints, or bug description (2-4 sentences).
            language: Programming language to set in Monaco (e.g. 'python', 'javascript', 'typescript', 'go').
            starter_code: Starter function template or code snippet containing intentional bugs to diagnose.
            time_limit_sec: Recommended time limit for the candidate in seconds (e.g. 180 to 420).
            mode: 'write_code' for writing a solution from scratch, or 'fix_bug' for spotting and fixing flaws.
        """
        task_id = f"task-{int(time.time() * 1000)}"
        clean_lang = _normalize_lang(language)
        try:
            limit = int(time_limit_sec)
        except (TypeError, ValueError):
            limit = 300
        effective_limit = max(60, min(1200, limit))
        clean_mode = mode if mode in ("write_code", "fix_bug") else "write_code"

        task_payload = {
            "type": "present_task",
            "taskId": task_id,
            "title": title.strip(),
            "description": description.strip(),
            "language": clean_lang,
            "starterCode": starter_code or "# Write your solution below\n",
            "timeLimitSec": effective_limit,
            "mode": clean_mode,
            "skill": "general",
            "difficulty": 2,
            "testCases": [],
            "hintsTotal": 0,
            "voiceFirst": True,
            "hideTimer": True,
        }

        stale = state.start_task(task_payload)

        logger.info(
            "[Tool Call] Presenting coding task '%s' (mode: %s, lang: %s, limit: %ds requested %s)",
            title, clean_mode, clean_lang, effective_limit, time_limit_sec,
        )
        await _broadcast("code_task", task_payload)
        if stale:
            logger.info("Superseded stale task '%s'", stale.get("title"))

        return (
            f"Successfully loaded coding task '{title}' into the candidate's Monaco Editor. "
            f"Mode: {clean_mode}. (Internal pacing budget {effective_limit}s — NEVER mention seconds or a countdown aloud.) "
            "Narrate the task in 1-2 warm spoken sentences: title + what to do + 'take your time, think aloud, "
            "just say I'm done when ready'. "
            "If they ask for help, call `give_coding_hint`. If they ask you to explain or edit code by voice, "
            "use `get_code_with_line_numbers` then `highlight_code_lines` or `edit_candidate_code`. "
            "When they indicate completion or speak next, call `grab_candidate_code` to review what they wrote."
        )

    @llm.function_tool(
        description=(
            "Present a vetted, skill-based coding challenge matched to the interview topic and candidate level. "
            "ALWAYS prefer this over inventing problems. It auto-selects from a curated bank (DSA, Web, GenAI, ML, "
            "System Design, SQL) with visible tests, progressive hints, and follow-ups. "
            "Pass skill_focus (e.g. 'dsa', 'web', 'genai', 'ml', 'system', 'sql'), difficulty 1-3, language, and mode."
        )
    )
    async def present_skill_challenge(
        skill_focus: str = "general",
        difficulty: int = 2,
        language: str = "python",
        mode: str | None = None,
    ) -> str:
        """Present a curated skill-based challenge with tests, hints, and follow-ups.
        Args:
            skill_focus: Skill area — one of 'dsa', 'web', 'genai', 'ml', 'system', 'sql', or 'general'.
            difficulty: 1=warm-up (Intern/Junior), 2=core (Mid), 3=stretch (Senior/Staff).
            language: Monaco language to present the starter code in.
            mode: Optional 'write_code' or 'fix_bug' to force a format; omit for bank default.
        """
        skill = normalize_skill(skill_focus, None) if skill_focus != "general" else "general"
        if skill == "general":
            # Map unknown topics to DSA default unless bank has general entries
            skill_key = "dsa"
        else:
            skill_key = skill
        try:
            diff = int(difficulty)
        except (TypeError, ValueError):
            diff = 2
        diff = max(1, min(3, diff))

        exclude = [t.get("challengeRef", {}).get("id", "") if isinstance(t.get("challengeRef"), dict) else "" for t in state.task_history]
        exclude += [t.get("taskId", "") for t in state.task_history]
        # Also exclude by bank id stored in history payloads
        bank_exclude = [t.get("challengeId") for t in state.task_history if t.get("challengeId")]

        challenge = pick_challenge(skill_key, diff, exclude_ids=bank_exclude, mode=mode)
        desc, starter, eff_lang = challenge_brief(challenge, _normalize_lang(language))
        # Respect requested mode override for display, but keep bank starter
        eff_mode = mode if mode in ("write_code", "fix_bug") else challenge["mode"]

        task_id = f"task-{int(time.time() * 1000)}"
        task_payload = {
            "type": "present_task",
            "taskId": task_id,
            "title": challenge["title"],
            "description": desc,
            "language": eff_lang,
            "starterCode": starter,
            "timeLimitSec": challenge.get("time_limit_sec", 300),
            "mode": eff_mode,
            "skill": challenge.get("skill", skill_key),
            "difficulty": challenge.get("difficulty", diff),
            "challengeId": challenge["id"],
            "challengeRef": {"id": challenge["id"]},
            "testCases": challenge.get("test_cases", []),
            "hintsTotal": len(challenge.get("hints", [])),
            "followUps": challenge.get("follow_ups", []),
            "voiceFirst": True,
            "hideTimer": True,
        }
        state.start_task(task_payload)
        logger.info(
            "[Tool Call] Presenting skill challenge '%s' (skill=%s diff=%d mode=%s lang=%s)",
            challenge["id"], skill_key, diff, eff_mode, eff_lang,
        )
        await _broadcast("code_task", task_payload)

        tests_summary = "; ".join(
            f"{t['input']} => {t['expected']}" for t in challenge.get("test_cases", [])[:2]
        )
        return (
            f"Loaded vetted challenge '{challenge['title']}' [{challenge['id']}, {eff_mode}, {eff_lang}]. "
            f"(Internal pacing budget {task_payload['timeLimitSec']}s — NEVER announce time or a countdown.) "
            f"Sample tests: {tests_summary}. "
            "Speak 1-2 warm sentences: name the task, the core skill it tests, 'take your time and think aloud, "
            "just say I'm done when you're ready'. "
            "If stuck: call `give_coding_hint`. If they ask you to explain or change code by voice: "
            "call `get_code_with_line_numbers`, then `highlight_code_lines` or `edit_candidate_code`. "
            "On completion signals: call `grab_candidate_code`. "
            f"After a good solve, ask a follow-up: '{(challenge.get('follow_ups') or [''])[0]}'"
        )

    @llm.function_tool(
        description=(
            "Give the candidate the next progressive hint for the active coding task (max 3, escalating). "
            "Call this when they are stuck, silent >60s, or explicitly ask for help. Never reveal the full solution."
        )
    )
    async def give_coding_hint() -> str:
        """Deliver the next progressive hint for the active coding challenge."""
        active = state.active_task
        if not active:
            return "No active coding task. If the candidate wants practice, call `present_skill_challenge` first."

        task_id = active.get("taskId", "")
        given = state.hints_given.get(task_id, 0)
        challenge = state.challenge_for_task(active)
        bank_hints = (challenge.get("hints") or []) if challenge else []

        if bank_hints:
            if given >= len(bank_hints):
                follow = (challenge.get("follow_ups") or [])
                return (
                    "All 3 hints already given for this task. Do NOT reveal the solution. "
                    "Instead, pair-program verbally: ask what they have tried, narrow to one failing test, "
                    + (f"or pivot with follow-up: '{follow[0]}'" if follow else "or offer to move on via `cancel_or_skip_task`.")
                )
            hint = bank_hints[given]
            state.hints_given[task_id] = given + 1
            return (
                f"Deliver Hint {given + 1} of {len(bank_hints)} aloud in ONE concise sentence, then stop and let them work: {hint} "
                "Do not add extra solution detail beyond this hint."
            )

        # Generic fallback for freeform tasks
        state.hints_given[task_id] = given + 1
        fallbacks = [
            "Ask them to restate the problem in their own words and name the brute force first.",
            "Ask which data structure maps inputs to answers, and what the smallest failing test is.",
            "Suggest they trace one concrete example line by line, then generalize the pattern.",
        ]
        hint = fallbacks[min(given, len(fallbacks) - 1)]
        return f"Speak this hint in one sentence and pause: {hint}"

    @llm.function_tool(
        description=(
            "Inspect the source code currently typed in the candidate's Monaco Editor. "
            "Call this whenever the candidate says 'I'm done', 'I finished', 'I fixed the bugs', 'Check my solution', "
            "or speaks after working on a coding task. "
            "Inspect their logic, algorithmic complexity (Big-O), edge cases, and accuracy, then give verbal feedback."
        )
    )
    async def grab_candidate_code() -> str:
        """Retrieve and inspect the candidate's live code from Monaco Editor."""
        code = (state.candidate_code or "").strip()
        lang = state.candidate_language or "python"
        active = state.active_task or {}

        logger.info("[Tool Call] Grabbing candidate code from Monaco Editor (length: %d chars, lang: %s)", len(code), lang)

        challenge = state.challenge_for_task(active)
        analysis = analyze_submission(code, lang, challenge)
        state.last_analysis = analysis

        def _fmt_checks() -> str:
            lines = []
            for c in analysis.get("checks", [])[:10]:
                mark = "PASS" if c["passed"] else "FAIL"
                lines.append(f"- [{mark}] {c['name']}: {c['detail']}")
            return "\n".join(lines)

        if not code:
            return (
                "The candidate's Monaco Editor is currently empty. "
                "Ask them gently if they have typed anything or if they need a hint (call `give_coding_hint`)."
            )

        lines = len(code.splitlines())
        task_info = ""
        if active:
            task_info = f"\nActive Task: '{active.get('title')}' (Mode: {active.get('mode')}, Skill: {active.get('skill', 'general')})"
            completed = state.complete_task(active.get("taskId"))
            if completed:
                await _broadcast("code_task", {
                    "type": "task_completed",
                    "taskId": completed.get("taskId"),
                })
            starter = (active.get("starterCode") or "").strip()
            if starter and code == starter:
                return (
                    f"The candidate has not made any changes to the starter code yet.{task_info}\n"
                    f"Current code in editor:\n```{lang}\n{code}\n```\n"
                    f"Static checks:\n{_fmt_checks()}\n"
                    "Ask them how they plan to approach the problem or offer Hint 1 via `give_coding_hint`."
                )

        similarity = analysis.get("similarity_to_starter")
        sim_note = f"\nSimilarity to starter: {similarity} (near 1.0 = trivial edit)." if similarity is not None else ""
        big_o = (challenge.get("optimal_big_o") if challenge else None) or "discuss trade-offs"
        follow = ((challenge.get("follow_ups") or [""])[0]) if challenge else ""

        return (
            f"Candidate's Monaco Editor Submission ({lang}, {lines} lines):{task_info}\n"
            f"```{lang}\n{code}\n```\n"
            f"Deterministic static analysis (score_hint {analysis.get('score_hint')}/100, syntax_ok={analysis.get('syntax_ok')}"
            f"{'; error: ' + analysis['syntax_error'] if analysis.get('syntax_error') else ''}):\n{_fmt_checks()}{sim_note}\n"
            f"Expected optimal: {big_o}."
            + (f"\nSuggested follow-up after feedback: '{follow}'" if follow else "") + "\n"
            "INSTRUCTIONS: Ground your spoken reply in these checks. Formulate 1-3 spoken sentences discussing "
            "their approach, correctness, Big-O complexity, potential edge cases, or congratulating them on fixing the bug. "
            "If syntax_ok is False, say so plainly and point at the error. Never recite raw code aloud. "
            "If the solution is strong, ask ONE follow-up next. If weak, offer a hint or a simpler task."
        )

    @llm.function_tool(
        description=(
            "Read the candidate's current editor code WITH line numbers for grounding explanations and edits. "
            "Call this BEFORE highlight_code_lines / edit_candidate_code, or when the candidate asks "
            "'what does this line do', 'explain', 'where is the bug'."
        )
    )
    async def get_code_with_line_numbers(start_line: int = 1, max_lines: int = 120) -> str:
        """Return the live editor buffer with 1-indexed line numbers."""
        code = state.candidate_code or ""
        lang = state.candidate_language or "python"
        active = state.active_task or {}
        total = len(code.splitlines()) if code.strip() else 0
        return (
            f"Live editor ({lang}, {total} lines, task: '{active.get('title', 'none')}'):\n"
            + numbered_code(code, start=max(1, start_line), limit=max_lines) + "\n"
            "Use these exact 1-indexed line numbers for highlight/edit calls. "
            "Explain aloud in plain words — never recite the whole listing."
        )

    @llm.function_tool(
        description=(
            "Highlight 1-8 lines in the candidate's editor to point at code while you explain by voice. "
            "Use when they say 'I don't understand this part', 'which line', 'show me the bug'. "
            "No code is changed; the editor flashes the range."
        )
    )
    async def highlight_code_lines(
        start_line: int,
        end_line: int,
        message: str = "Look at this section",
    ) -> str:
        """Flash-highlight a line range in the candidate's Monaco editor."""
        active = state.active_task
        if not active:
            return "No active coding task to highlight in."
        try:
            s = max(1, int(start_line))
            e = max(s, min(int(end_line), s + 7))
        except (TypeError, ValueError):
            return "Invalid line numbers. First call get_code_with_line_numbers, then retry with 1-indexed lines."
        total = len((state.candidate_code or "").splitlines())
        if total and s > total:
            return f"Line {s} is past the end of the file ({total} lines). Check numbering via get_code_with_line_numbers first."
        ok = await _broadcast("code_task", {
            "type": "code_highlight",
            "taskId": active.get("taskId"),
            "startLine": s,
            "endLine": min(e, max(total, e)),
            "message": (message or "Look at this section")[:200],
        })
        if not ok:
            return "Could not reach the editor (room disconnected). Explain verbally instead, referencing line numbers."
        return (
            f"Highlighted lines {s}-{e} in the candidate's editor. "
            "Now explain THAT range aloud in 1-2 short sentences: what it does + why it matters here. "
            "End with a check: 'does that part make sense?'"
        )

    @llm.function_tool(
        description=(
            "Edit the candidate's Monaco editor LIVE on their voice request (pair-programming). "
            "Use ONLY when they explicitly ask you to write, fix, replace, add, or remove code "
            "('can you fix line 5', 'type the loop for me', 'replace X with Y'). "
            "Small surgical edits only (<=12 lines). The editor updates in realtime with an Undo option."
        )
    )
    async def edit_candidate_code(
        start_line: int,
        end_line: int,
        new_text: str,
        reason: str = "Interviewer edit",
    ) -> str:
        """Replace lines [start_line, end_line] (1-indexed, inclusive) with new_text, broadcast live."""
        active = state.active_task
        if not active:
            return "No active coding task. Present one first before editing."
        if new_text is None:
            return "new_text is required — provide the exact replacement lines."
        if len((new_text or "").splitlines()) > 14:
            return "Edit too large (>14 lines). Break it into smaller steps: explain, then apply one hunk at a time."
        # Avoid clobbering a candidate who is actively typing this second
        if time.time() - state.last_code_at < 1.5:
            return (
                "The candidate typed within the last ~1.5s — hold the edit for a beat to avoid a conflict. "
                "Say 'let me update that right after you pause' and retry in a few seconds."
            )
        try:
            s = int(start_line)
            e = int(end_line)
        except (TypeError, ValueError):
            return "Invalid line numbers. Call get_code_with_line_numbers first, then retry."
        current = state.candidate_code or ""
        total = len(current.splitlines())
        if total == 0:
            return "Editor is empty — ask them what starter they want before writing code for them."
        if s < 1 or s > total + 1:
            return f"start_line {s} out of range (file has {total} lines). Re-check with get_code_with_line_numbers."
        new_code, after = apply_line_patch(current, s, e, new_text)
        state.patch_seq += 1
        patch_id = f"patch-{int(time.time() * 1000)}-{state.patch_seq}"
        state.set_code(new_code, state.candidate_language)
        state.patches_applied.append({
            "patch_id": patch_id,
            "task_id": active.get("taskId"),
            "start_line": s,
            "end_line": e,
            "reason": reason[:200],
            "at": time.time(),
        })
        ok = await _broadcast("code_task", {
            "type": "code_patch",
            "taskId": active.get("taskId"),
            "patchId": patch_id,
            "startLine": s,
            "endLine": e,
            "newText": new_text,
            "fullCode": new_code,
            "language": state.candidate_language,
            "reason": (reason or "Interviewer edit")[:200],
        })
        if not ok:
            return "Edit applied locally but the room is disconnected — narrate the change verbally instead."
        return (
            f"Applied live edit {patch_id}: replaced lines {s}-{e} ({after} lines now). "
            "Narrate in ONE sentence what you changed and why (no code recital), "
            "then ask them to continue: 'want to take it from here?'"
        )

    @llm.function_tool(
        description=(
            "Cancel, skip, or clear the active coding task if the candidate rejects it, asks for a different question, "
            "or if you decide to move on."
        )
    )
    async def cancel_or_skip_task(reason: str = "Candidate or interviewer requested skip") -> str:
        """Dismiss the active coding challenge and reset the editor status."""
        logger.info("[Tool Call] Canceling coding task: %s", reason)
        old_task = state.active_task
        if old_task:
            old_task["cancelReason"] = reason[:200]
            old_task["elapsedSec"] = round(state.elapsed_since_present(), 1)
        state.active_task = None
        state.presented_at = None
        state.nudges_sent = set()
        state.unanswered_checkins = 0
        if old_task:
            state.completed_task_ids.add(old_task.get("taskId", ""))
        await _broadcast("code_task", {
            "type": "task_cancelled",
            "reason": reason,
        })
        title = old_task.get("title") if old_task else "Task"
        return f"Coding task '{title}' has been cancelled. Propose an alternative: call `present_skill_challenge` with a lower difficulty or different skill, then transition smoothly."

    return [
        present_coding_task,
        present_skill_challenge,
        get_code_with_line_numbers,
        highlight_code_lines,
        edit_candidate_code,
        give_coding_hint,
        grab_candidate_code,
        cancel_or_skip_task,
    ]
