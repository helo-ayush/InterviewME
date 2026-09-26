import logging
from dotenv import load_dotenv
import json

from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    WorkerOptions,
    cli,
)
from livekit.plugins import google

load_dotenv()

logger = logging.getLogger("voice-agent")
logging.basicConfig(level=logging.INFO)

system_prompt = ""

class InterviewAgent(Agent):
    def __init__(self, system_prompt: str | None) -> None:
        super().__init__(
            instructions= system_prompt or ( 
                "You are a warm, professional tech interviewer. "
                "Ask the candidate questions, listen to their answers, "
                "and follow up naturally." ),
            llm=google.realtime.RealtimeModel(
                model="gemini-3.1-flash-live-preview",
                voice="Puck",  # Optional but recommended
                temperature=0.7,
            ),
        )


async def entrypoint(ctx: JobContext):
    logger.info(f"Connecting to room {ctx.room.name}...")
    await ctx.connect()
    logger.info("Connected to room!")
    
    metadata = json.loads(ctx.job.metadata or "{}")
    system_prompt = metadata.get("systemPrompt")

    session = AgentSession(use_tts_aligned_transcript=True)

    logger.info("Starting Gemini 3.1 Interview Agent...")
    agent = InterviewAgent(system_prompt)
    await session.start(
        agent=agent,
        room=ctx.room,
    )

    logger.info("Agent started successfully!")


if __name__ == "__main__":
    # Start a simple health check HTTP server on port 7860 for Hugging Face Spaces
    try:
        import threading
        from http.server import BaseHTTPRequestHandler, HTTPServer
        
        class HealthHandler(BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(200)
                self.send_header("Content-type", "text/plain")
                self.end_headers()
                self.wfile.write(b"OK")
            def log_message(self, format, *args):
                pass  # suppress request logs to keep stdout clean
                
        def run_health_server():
            logger.info("Starting health check server on port 7860...")
            try:
                server = HTTPServer(("0.0.0.0", 7860), HealthHandler)
                server.serve_forever()
            except Exception as ex:
                logger.error(f"Health server failed: {ex}")
            
        threading.Thread(target=run_health_server, daemon=True).start()
    except Exception as e:
        logger.error(f"Failed to start health check server: {e}")

    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            agent_name="interview-agent",   # ✅ ADD THIS
        )
    )