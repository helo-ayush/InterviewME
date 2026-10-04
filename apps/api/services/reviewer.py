import json
import logging
import os
import re
import httpx

from config import settings

logger = logging.getLogger("interviewme.reviewer")

GREETING_WORDS = {
    "hi", "hello", "hey", "yes", "yeah", "no", "nope", "okay", "ok",
    "can", "you", "hear", "me", "am", "i", "audible", "test", "testing",
    "good", "morning", "afternoon", "evening", "thanks", "thank", "bye"
}


def _is_minimal_or_empty_interview(transcript: list) -> tuple[bool, str]:
    """Check if the interview contains zero or negligible technical content."""
    cand_texts = [
        item.get("text", "").strip()
        for item in transcript
        if item.get("role") not in ("agent", "assistant", "interviewer") and item.get("text", "").strip()
    ]
    if not cand_texts:
        return True, "No candidate speech was detected during the interview session."

    combined = " ".join(cand_texts).lower()
    words = re.findall(r"\b[a-z0-9_+-]+\b", combined)

    # If candidate spoke fewer than 15 total words
    if len(words) < 15:
        return True, "The candidate only spoke a few words during the session and did not answer any interview questions."

    # If over 80% of candidate words are just greetings and mic-check words
    greeting_count = sum(1 for w in words if w in GREETING_WORDS)
    if len(words) < 30 and (greeting_count / len(words)) >= 0.7:
        return True, "The conversation was limited to greetings and audio checks with no technical responses provided."

    return False, ""


def _minimal_interview_evaluation(topic: str, reason: str) -> dict:
    """Strict 0-score evaluation for interviews without substantive candidate responses."""
    return {
        "overall_score": 0,
        "recommendation": "Needs Improvement",
        "summary": (
            f"No technical answers or problem-solving responses were provided during this {topic} session. "
            f"{reason} Evaluation is marked as incomplete with zero points awarded."
        ),
        "category_scores": {
            "technical_accuracy": 0,
            "communication_clarity": 5,
            "problem_solving": 0,
            "practical_application": 0,
        },
        "strengths": [
            "Initiated connection to the interview room.",
        ],
        "improvements": [
            "Engage with the interviewer's technical questions rather than disconnecting early.",
            "Explain your technical thought process and solution design aloud.",
            f"Discuss practical architectures, code implementation, and trade-offs for {topic}.",
        ],
        "actionable_tips": [
            f"Prepare 2-3 minute structured explanations for core technical concepts in {topic}.",
            "When asked a question, define the problem, state assumptions, and walk through your approach step-by-step.",
            "Complete a full 10-15 minute mock interview without ending the call prematurely.",
        ],
        "key_moments": [
            {
                "quote": "Session terminated prematurely",
                "feedback": "A complete technical interview requires answering questions and demonstrating domain knowledge.",
            }
        ],
    }


async def generate_interview_review(
    topic: str,
    candidate_info: dict,
    transcript: list,
    code_workspace: dict | None = None,
) -> dict:
    """Generate a strict, uncompromising AI review and scorecard from interview transcript and Monaco code."""
    # 1. First check if the candidate provided virtually no technical content
    is_minimal, reason = _is_minimal_or_empty_interview(transcript)
    submitted_code = (code_workspace or {}).get("code", "").strip() if code_workspace else ""
    submitted_lang = (code_workspace or {}).get("language", "python") if code_workspace else "python"
    tasks_history = (code_workspace or {}).get("task_history", []) if code_workspace else []

    # If transcript is minimal AND no code was written, give 0
    if is_minimal and not submitted_code:
        logger.info("Interview identified as minimal/empty (no speech, no code): %s. Returning strict 0 scorecard.", reason)
        return _minimal_interview_evaluation(topic, reason)

    api_key = settings.groq_api_key or os.getenv("GROQ_API_KEY")
    if not api_key:
        logger.warning("GROQ_API_KEY is not set. Generating strict deterministic review.")
        return _fallback_review(topic, candidate_info, transcript, code_workspace)

    # Format transcript into human-readable dialog
    dialog_lines = []
    for item in transcript:
        role = item.get("role", "candidate")
        text = (item.get("text") or "").strip()
        if not text:
            continue
        speaker = "Interviewer" if role in ("agent", "interviewer", "assistant") else "Candidate"
        dialog_lines.append(f"{speaker}: {text}")

    dialog_text = "\n".join(dialog_lines) if dialog_lines else "(No speech transcribed)"

    cand_name = candidate_info.get("name", "Candidate")
    cand_role = candidate_info.get("role", "Software Engineer")
    cand_level = candidate_info.get("experience_level", "Junior")
    cand_skills = ", ".join(candidate_info.get("skills", [])) or "General tech stack"

    code_section = ""
    if submitted_code:
        code_section = f"""
[CANDIDATE MONACO EDITOR CODE SUBMISSION]
Language: {submitted_lang}
Assigned Tasks: {len(tasks_history)}
Submitted Code:
```{submitted_lang}
{submitted_code[:3000]}
```
"""

    system_prompt = f"""You are a RUTHLESSLY STRICT, UNCOMPROMISING Tech Hiring Bar-Raiser and Principal Engineering Assessor.
You evaluate technical mock interviews according to the highest industry standards (Google/Meta L5/L6 bar).

Target Topic: {topic}
Candidate: {cand_name} (Targeting: {cand_role}, Experience Level: {cand_level})
Background Skills: {cand_skills}

STRICT SCORING RULES (NOT FORGIVING):
1. NO FREE POINTS. Points must be earned solely by correct, articulate, in-depth technical explanations and code implementation.
2. If the candidate gave superficial, shallow, or generic answers: Score between 25-45.
3. If the candidate struggled, gave incorrect technical details, or showed confusion: Score below 35.
4. If the candidate only answered 1 question decently and avoided depth: Score 40-55.
5. A score of 70-80 requires solid, accurate fundamentals, clear trade-offs, and confident communication / working code.
6. A score above 85 is strictly reserved for flawless, senior-level mastery with proactive edge-case, clean algorithm design, and architecture handling.
7. NEVER invent or hallucinate strengths! If the candidate did not demonstrate depth, do NOT say "Strong understanding". State the exact deficiencies.
8. If the candidate only spoke trivial greetings or brief phrases and submitted no code, score MUST be 0-10 with recommendation "Needs Improvement".

SCORING CATEGORIES:
- Technical Accuracy & Depth (0-100): Accuracy of concepts, correct syntax/mechanics, depth of explanations.
- Communication Clarity (0-100): Structured speech, concise answers, avoiding rambles or dead air.
- Problem Solving & Logic (0-100): Analytical reasoning, algorithmic decomposition, bug hunting and resolution.
- Practical Application (0-100): Real-world engineering trade-offs, scalability, failure handling, testing, edge cases.

Return JSON ONLY matching this exact structure:
{{
  "overall_score": <number 0-100>,
  "recommendation": "<'Strong Hire' | 'Hire' | 'Leaning Hire' | 'Needs Improvement'>",
  "summary": "<2-3 sentence rigorous, objective evaluation of what the candidate actually demonstrated>",
  "category_scores": {{
    "technical_accuracy": <number 0-100>,
    "communication_clarity": <number 0-100>,
    "problem_solving": <number 0-100>,
    "practical_application": <number 0-100>
  }},
  "code_assessment": {{
    "has_code": { "true" if submitted_code else "false" },
    "language": "{submitted_lang}",
    "submitted_code": "<escaped submitted code snippet or empty string>",
    "correctness": "<'Optimal' | 'Partially Correct' | 'Has Bugs' | 'Unattempted'>",
    "time_complexity": "<e.g. O(N) or N/A>",
    "space_complexity": "<e.g. O(1) or N/A>",
    "feedback": "<2-3 sentences assessing algorithmic quality, edge cases, bug resolution, or note if unattempted>"
  }},
  "strengths": [
    "<Only list genuine strengths evidenced in dialog or code. If none, explicitly note 'No significant technical strengths demonstrated.'>"
  ],
  "improvements": [
    "<2-4 direct, honest criticisms of where candidate fell short or lacked depth>"
  ],
  "actionable_tips": [
    "<3 high-impact study or interview strategy recommendations>"
  ],
  "key_moments": [
    {{
      "quote": "<exact or paraphrased quote from dialog>",
      "feedback": "<critical analysis of what was good or what was missing>"
    }}
  ]
}}
"""

    user_prompt = f"""[INTERVIEW DIALOG]
{dialog_text}
{code_section}

Provide your strict, objective evaluation JSON."""

    try:
        model = getattr(settings, "groq_model", None) or os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
        async with httpx.AsyncClient(timeout=25) as client:
            res = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.1,
                },
            )
            if res.status_code == 200:
                data = res.json()
                content = data["choices"][0]["message"]["content"]
                content = content.replace("\u2011", "-").replace("\u2013", "-").replace("\u2014", "--")
                parsed = json.loads(content)
                logger.info("Successfully generated strict AI review for topic: %s (score: %s)", topic, parsed.get("overall_score"))
                return parsed
            else:
                logger.error("Groq API review generation returned %s: %s", res.status_code, res.text)
    except Exception as exc:
        logger.error("Failed to generate AI review via Groq: %s", exc)

    return _fallback_review(topic, candidate_info, transcript, code_workspace)


def _fallback_review(topic: str, candidate_info: dict, transcript: list, code_workspace: dict | None = None) -> dict:
    """Strict deterministic fallback when external AI service is unreachable."""
    cand_turns = sum(1 for item in transcript if item.get("role") not in ("agent", "assistant", "interviewer"))
    cand_words = sum(
        len(item.get("text", "").split())
        for item in transcript
        if item.get("role") not in ("agent", "assistant", "interviewer")
    )

    if cand_turns < 2 or cand_words < 25:
        return _minimal_interview_evaluation(topic, "Insufficient speech for evaluation.")

    # Modest performance rubric
    overall = min(58, 25 + cand_turns * 5)
    submitted_code = ((code_workspace or {}).get("code") or "").strip()
    submitted_lang = (code_workspace or {}).get("language") or "python"
    has_code = bool(submitted_code)
    if has_code:
        overall = min(68, overall + 8)
    return {
        "overall_score": overall,
        "recommendation": "Needs Improvement" if overall < 65 else "Leaning Hire",
        "summary": (
            f"Candidate attempted the {topic} interview but responses were brief. "
            "More extensive depth and structured technical communication are required to pass the bar."
        ),
        "category_scores": {
            "technical_accuracy": max(15, overall - 5),
            "communication_clarity": overall,
            "problem_solving": max(10, overall - 10),
            "practical_application": max(10, overall - 8),
        },
        "strengths": [
            "Attempted responses to the interviewer's prompts.",
        ],
        "improvements": [
            "Provide substantially more technical depth rather than brief surface-level statements.",
            "Explain trade-offs and edge-cases proactively.",
        ],
        "actionable_tips": [
            f"Deep-dive into fundamental concepts and architecture patterns for {topic}.",
            "Practice continuous verbal walkthroughs of technical problems.",
        ],
        "code_assessment": {
            "has_code": has_code,
            "language": submitted_lang,
            "submitted_code": submitted_code[:3000],
            "correctness": "Partially Correct" if has_code else "Unattempted",
            "time_complexity": "N/A",
            "space_complexity": "N/A",
            "feedback": (
                "Code was submitted but the AI reviewer was unreachable, so only a heuristic fallback applies. "
                "Re-run with refresh once Groq is configured for a full assessment."
                if has_code else
                "No code was submitted in the Monaco editor during this session."
            ),
        },
        "key_moments": [],
    }
