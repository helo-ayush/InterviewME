---
title: Technical Interview Voice Agent
emoji: 🎙️
colorFrom: indigo
colorTo: violet
sdk: docker
app_port: 7860
pinned: false
---

# Technical Interview Voice Agent (LiveKit + Gemini Live API)

This is a real-time voice agent built using the **LiveKit Agent Framework** and the **Gemini Multimodal Live API** (`gemini-3.1-flash-live-preview`). It conducts technical interviews with candidates, guiding them through warming up, talking about their resume, probing their GitHub repositories, and discussing system design scenarios.

## How it works

1. The frontend initiates an interview session and obtains a LiveKit token from the backend.
2. The LiveKit Server dispatches a worker job to this agent.
3. This agent connects to the room, connects to the Gemini Multimodal Live API via WebSockets, greets the candidate, and conducts a voice-to-voice interview.
4. A background thread runs a health check server on port `7860` to keep the Hugging Face Space running and healthy.

## Hugging Face Spaces Deployment Configuration

Hugging Face Spaces expects variables and secrets to be configured in the Space settings.

### Required Secrets

Go to your **Space Settings** -> **Variables and Secrets** and add the following:

| Secret Name | Description |
|-------------|-------------|
| `LIVEKIT_URL` | Your LiveKit Server URL (e.g. `wss://your-project.livekit.cloud`) |
| `LIVEKIT_API_KEY` | Your LiveKit API Key |
| `LIVEKIT_API_SECRET` | Your LiveKit API Secret |
| `GEMINI_API_KEY` | Your Google Gemini API Key |

## Local Development

If you want to run this agent locally:

1. Create a Python virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # Or venv\Scripts\activate on Windows
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Set up environment variables in a `.env` file.

4. Run the agent in development mode:
   ```bash
   python agent.py dev
   ```
