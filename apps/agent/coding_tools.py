import json
import logging
import time
from livekit import rtc
from livekit.agents import llm

logger = logging.getLogger("interviewme.agent.coding_tools")


class CodingSessionState:
    """Maintains active coding challenge state and real-time candidate code buffer."""

    def __init__(self) -> None:
        self.active_task: dict | None = None
        self.candidate_code: str = ""
        self.candidate_language: str = "python"
        self.last_sync_timestamp: float = 0.0
        self.task_history: list[dict] = []
        self.rejected_tasks: list[dict] = []

    def set_code(self, code: str, language: str = "python") -> None:
        self.candidate_code = code
        self.candidate_language = language or "python"
        self.last_sync_timestamp = time.time()

    def record_rejection(self, task_id: str, reason: str = "") -> None:
        self.rejected_tasks.append({
            "task_id": task_id,
            "rejected_at": time.time(),
            "reason": reason,
        })
        self.active_task = None


def create_coding_tools(
    room: rtc.Room,
    state: CodingSessionState,
) -> list[llm.FunctionTool]:
    """Factory creating LiveKit function tools for collaborative Monaco code interaction."""

    async def _broadcast(topic: str, payload: dict) -> bool:
        try:
            if room.isconnected() and room.local_participant:
                data = json.dumps(payload).encode("utf-8")
                await room.local_participant.publish_data(
                    payload=data,
                    topic=topic,
                    reliable=True,
                )
                return True
        except Exception as exc:
            logger.warning("Failed to broadcast on topic '%s': %s", topic, exc)
        return False

    @llm.function_tool(
        description=(
            "Load a coding challenge or a buggy code snippet directly into the candidate's browser Monaco Editor. "
            "Use this during technical problem-solving or practical coding stages. "
            "Specify title, problem description, starter or buggy code, language (e.g. 'python', 'javascript', 'typescript', 'go'), "
            "time_limit_sec (default 300s = 5 minutes), and mode ('write_code' for new implementation or 'fix_bug' for debugging)."
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
        clean_lang = (language or "python").lower()
        if clean_lang in ("py", "python3"):
            clean_lang = "python"
        elif clean_lang in ("js", "node"):
            clean_lang = "javascript"
        elif clean_lang in ("ts",):
            clean_lang = "typescript"

        task_payload = {
            "type": "present_task",
            "taskId": task_id,
            "title": title.strip(),
            "description": description.strip(),
            "language": clean_lang,
            "starterCode": starter_code or "# Write your solution below\n",
            "timeLimitSec": max(60, min(1200, time_limit_sec)),
            "mode": mode if mode in ("write_code", "fix_bug") else "write_code",
        }

        state.active_task = task_payload
        state.task_history.append(task_payload)
        # Pre-seed candidate code with starter code
        state.set_code(starter_code or "", clean_lang)

        logger.info("[Tool Call] Presenting coding task '%s' (mode: %s, lang: %s, limit: %ds)", title, mode, clean_lang, time_limit_sec)
        await _broadcast("code_task", task_payload)

        return (
            f"Successfully loaded coding task '{title}' into the candidate's Monaco Editor. "
            f"Mode: {mode}. Timer started for {time_limit_sec} seconds. "
            "Inform the candidate in 1-2 concise spoken sentences what the task is. "
            "Wait for them to write or debug their code. When they indicate completion or speak next, "
            "call `grab_candidate_code` to review what they wrote."
        )

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

        if not code:
            return (
                "The candidate's Monaco Editor is currently empty. "
                "Ask them gently if they have typed anything or if they need a hint to get started."
            )

        lines = len(code.splitlines())
        task_info = ""
        if active:
            task_info = f"\nActive Task: '{active.get('title')}' (Mode: {active.get('mode')})"
            starter = (active.get("starterCode") or "").strip()
            if starter and code == starter:
                return (
                    f"The candidate has not made any changes to the starter code yet.{task_info}\n"
                    f"Current code in editor:\n```{lang}\n{code}\n```\n"
                    "Ask them how they plan to approach the problem or if they'd like to talk through their thoughts."
                )

        return (
            f"Candidate's Monaco Editor Submission ({lang}, {lines} lines):{task_info}\n"
            f"```{lang}\n{code}\n```\n"
            "INSTRUCTIONS: Analyze this code carefully. Formulate 1-3 spoken sentences discussing "
            "their approach, correctness, Big-O complexity, potential edge cases, or congratulating them on fixing the bug. "
            "Never recite raw code aloud."
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
        state.active_task = None
        await _broadcast("code_task", {
            "type": "task_cancelled",
            "reason": reason,
        })
        title = old_task.get("title") if old_task else "Task"
        return f"Coding task '{title}' has been cancelled. You can now propose an alternative problem or transition to another topic."

    return [
        present_coding_task,
        grab_candidate_code,
        cancel_or_skip_task,
    ]
