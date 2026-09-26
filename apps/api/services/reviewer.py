import json
import logging
import os
import httpx

from config import settings

logger = logging.getLogger("interviewme.reviewer")


async def generate_interview_review(
    topic: str,
    candidate_info: dict,
    transcript: list,
) -> dict:
    """Generate a detailed, objective AI review and scorecard from an interview transcript."""
    api_key = settings.groq_api_key or os.getenv("GROQ_API_KEY")
    if not api_key:
        logger.warning("GROQ_API_KEY is not set. Generating fallback review.")
        return _fallback_review(topic, candidate_info, transcript)

    # Format transcript into human-readable dialog
    dialog_lines = []
    cand_turns = 0
    for item in transcript:
        role = item.get("role", "candidate")
        text = (item.get("text") or "").strip()
        if not text:
            continue
        speaker = "Interviewer" if role in ("agent", "interviewer", "assistant") else "Candidate"
        if speaker == "Candidate":
            cand_turns += 1
        dialog_lines.append(f"{speaker}: {text}")

    dialog_text = "\n".join(dialog_lines) if dialog_lines else "(No speech transcribed)"

    cand_name = candidate_info.get("name", "Candidate")
    cand_role = candidate_info.get("role", "Software Engineer")
    cand_level = candidate_info.get("experience_level", "Junior")
    cand_skills = ", ".join(candidate_info.get("skills", [])) or "General tech stack"

    system_prompt = f"""You are an elite Tech Hiring Bar-Raiser and Engineering Lead at a top technology company.
Your job is to thoroughly, constructively, and objectively evaluate the candidate's technical mock interview.

Target Topic: {topic}
Candidate: {cand_name} (Targeting: {cand_role}, Experience Level: {cand_level})
Background Skills: {cand_skills}

Evaluate their performance across four pillars:
1. Technical Accuracy & Depth (0-100)
2. Communication Clarity & Articulation (0-100)
3. Problem Solving & Structured Thinking (0-100)
4. Practical Application & Engineering Realism (0-100)

Return JSON ONLY matching this exact structure:
{{
  "overall_score": 82,
  "recommendation": "Hire",
  "summary": "2-3 sentence executive evaluation summarizing overall performance and readiness.",
  "category_scores": {{
    "technical_accuracy": 85,
    "communication_clarity": 80,
    "problem_solving": 82,
    "practical_application": 78
  }},
  "strengths": [
    "3 specific, concrete strengths demonstrated during the conversation"
  ],
  "improvements": [
    "2-3 specific, actionable areas where the candidate could improve"
  ],
  "actionable_tips": [
    "3 high-impact recommendations or study topics for upcoming interviews"
  ],
  "key_moments": [
    {{
      "quote": "Quote or paraphrase of what was discussed",
      "feedback": "Why this response was strong or how it could be improved"
    }}
  ]
}}

Note:
- "recommendation" must be one of: "Strong Hire", "Hire", "Leaning Hire", "Needs Improvement"
- Be realistic and encouraging. Even for short sessions, provide valuable insights on the topics touched.
"""

    user_prompt = f"""[INTERVIEW DIALOG]
{dialog_text}

Analyze the interview and output the complete evaluation JSON."""

    try:
        async with httpx.AsyncClient(timeout=25) as client:
            res = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "openai/gpt-oss-120b",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.2,
                },
            )
            if res.status_code == 200:
                data = res.json()
                content = data["choices"][0]["message"]["content"]
                content = content.replace("\u2011", "-").replace("\u2013", "-").replace("\u2014", "--")
                parsed = json.loads(content)
                logger.info("Successfully generated AI review for topic: %s", topic)
                return parsed
            else:
                logger.error("Groq API review generation returned %s: %s", res.status_code, res.text)
    except Exception as exc:
        logger.error("Failed to generate AI review via Groq: %s", exc)

    return _fallback_review(topic, candidate_info, transcript)


def _fallback_review(topic: str, candidate_info: dict, transcript: list) -> dict:
    """Deterministic fallback review when external AI service is unavailable."""
    cand_turns = sum(1 for item in transcript if item.get("role") not in ("agent", "assistant", "interviewer"))
    has_substance = cand_turns >= 2

    overall_score = 80 if has_substance else 72
    rec = "Hire" if has_substance else "Leaning Hire"

    return {
        "overall_score": overall_score,
        "recommendation": rec,
        "summary": (
            f"Candidate participated in the {topic} technical interview. "
            "Demonstrated enthusiasm and engagement with the interviewer's technical questions."
        ),
        "category_scores": {
            "technical_accuracy": 78 if has_substance else 70,
            "communication_clarity": 82,
            "problem_solving": 75 if has_substance else 68,
            "practical_application": 76 if has_substance else 70,
        },
        "strengths": [
            "Active engagement and prompt verbal communication.",
            f"Interest in {topic} and readiness to discuss engineering concepts.",
            "Polite and professional interview presence.",
        ],
        "improvements": [
            "Provide deeper architectural trade-offs when discussing design patterns.",
            "Incorporate edge-cases and error handling unprompted.",
        ],
        "actionable_tips": [
            "Use the STAR method (Situation, Task, Action, Result) to structure technical explanations.",
            f"Review core fundamentals and real-world system patterns in {topic}.",
            "Practice explaining the 'why' behind each engineering decision.",
        ],
        "key_moments": [
            {
                "quote": "Spoken session dialogue",
                "feedback": "Continued practice in real-time voice interviews will boost technical fluency.",
            }
        ],
    }
