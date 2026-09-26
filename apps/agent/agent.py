import json
import logging

from dotenv import load_dotenv
from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, cli
from livekit.plugins import deepgram, openai, silero

load_dotenv()

logger = logging.getLogger("interviewme-agent")
logging.basicConfig(level=logging.INFO)

DEFAULT_PROMPT = (
    "You are a warm, professional technical interviewer. "
    "Ask the candidate questions one at a time and follow up naturally."
)


class InterviewAgent(Agent):
    def __init__(self, instructions: str) -> None:
        super().__init__(instructions=instructions)


async def entrypoint(ctx: JobContext) -> None:
    logger.info("Connecting to room %s", ctx.room.name)
    await ctx.connect()

    metadata = json.loads(ctx.job.metadata or "{}")
    context_id = metadata.get("context_id")
    logger.info("Interview context id: %s", context_id)
    # M4: fetch the full candidate context from the API using context_id
    # and build the phased system prompt from it.

    session = AgentSession(vad=silero.VAD.load())
    await session.start(
        agent=InterviewAgent(DEFAULT_PROMPT),
        room=ctx.room,
        stt=deepgram.STT(model="nova-3"),
        tts=deepgram.TTS(model="aura-2-angus-en"),
        llm=openai.LLM.with_groq(model="openai/gpt-oss-120b"),
    )


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
