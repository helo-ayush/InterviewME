# InterviewME — Implementation Plan

AI voice mock-interview platform. A user signs in, completes onboarding (profile → resume → GitHub), picks any topic + duration from the dashboard, and is dropped straight into a live voice interview with an AI agent that paces itself through fixed interview phases, probes the candidate's real GitHub repos on demand, and afterwards produces a graded performance report.

**Context:** built for a hackathon — priority is a working end-to-end demo, not SaaS-grade polish. If a component fails after 2–3 genuine attempts, put it ON HOLD, flag it, and propose an alternative instead of sinking time.

---

## 1. Tech Stack (locked)

| Layer | Choice |
|---|---|
| Frontend | Next.js 15 (App Router) + Tailwind v4 + shadcn/ui |
| Auth | Clerk (`@clerk/nextjs`) |
| Voice transport | LiveKit Cloud (free tier) + `@livekit/components-react` |
| Realtime agent | Python `livekit-agents` worker |
| REST API | FastAPI + Pydantic v2 |
| Database | **Supabase Postgres** via SQLAlchemy 2 + Alembic (use pooler for app, direct connection for migrations) |
| File storage | Supabase Storage (private bucket) for resumes |
| STT | Deepgram `nova-3` (English only) |
| TTS | Deepgram Aura-2 |
| LLM (realtime) | Groq `openai/gpt-oss-120b` via `livekit.plugins.openai.LLM.with_groq()` |
| LLM (report grading) | Groq `openai/gpt-oss-120b` via plain REST call over the transcript |

**Monorepo layout:**
```
/apps/web      → Next.js
/apps/api      → FastAPI (REST)
/apps/agent    → livekit-agents worker
```
Old `client/`, `server/`, `python/` are deleted in Milestone 0. Project name stays **InterviewME**.

## 2. User Flow

```
Sign in (Clerk)
  → /onboarding  (middleware-gated until profile complete)
      Step 1: name, target role, experience level, skills
      Step 2: upload CV/resume (PDF/DOCX) → parsed + LLM-summarized server-side
      Step 3: connect GitHub (OAuth) → token stored encrypted → repo snapshot cached
      (Step 4: LinkedIn — future, placeholder only)
  → /dashboard
      Centered chat-style input: "Try any topic to start an interview…"
      Preset chips: Web Dev · Gen AI · AI/ML · DSA · System Design (DB-backed list)
      Topic (typed or preset) → duration (10/20/30/45 min) → Start
  → /interview/[sessionId]
      LiveKit room, mic permission, live transcript, countdown timer, End button
  → /interview/[sessionId]/report
      Graded report: overall letter grade, per-dimension scores, strengths,
      improvements, question-by-question review
```

## 3. Data Model (Supabase Postgres)

- **users**: clerk_id, name, role, experience_level, skills[], onboarding_complete
- **resumes**: user_id, storage_path, extracted_text, llm_summary
- **github_accounts**: user_id, github_login, access_token (encrypted), connected_at
- **github_snapshot**: user_id, repos jsonb (name, desc, language, topics, stars, fork), tech_stack[], fetched_at — refreshed if older than 7 days
- **interviews**: user_id, topic, duration_sec, room_name, status (scheduled/live/completed), started_at, ended_at, transcript jsonb
- **reports**: interview_id, overall_grade (A+/A/B+/B/C+/C/D), dimension_scores jsonb, strengths jsonb, improvements jsonb, question_review jsonb, generated_at

## 4. Interview Session Lifecycle

1. Dashboard Start → `POST /api/interviews` → creates row, LiveKit room + participant token; job metadata carries only a small `context_id` (prompts are too big for metadata).
2. Web joins room at `/interview/[id]`.
3. Agent worker picks up job → `GET /internal/candidate-context/{context_id}` (service key) → builds system prompt → starts `AgentSession(stt=deepgram, tts=deepgram, llm=groq)`.
4. On end (button or hard timer): agent outro → agent POSTs transcript + stats to `/internal/interviews/{id}/finish` → API triggers report generation (async Groq call) → report page polls/loads.

## 5. Agent Design

### 5.1 System prompt sections
```
[IDENTITY]     Interviewer persona, tone rules, English only, one question at a
               time, never answer for the candidate
[CANDIDATE]    Name, role, experience, resume summary, tech stacks, notable repos
[INTERVIEW]    Topic, duration, phase plan with target minute marks
[GITHUB TOOLS] Fetch on demand only; say a short bridge line before each fetch
[PACING]       Obey hidden system time updates
```

### 5.2 Phase engine (topic-agnostic, % of chosen duration)
| Phase | % |
|---|---|
| 1. Intro & warm-up | 10% |
| 2. Fundamentals | 25% |
| 3. Deep dive | 30% |
| 4. Project/GitHub probing | 20% |
| 5. Wrap-up | 15% |

Background `asyncio` task injects hidden instructions via `session.generate_reply(instructions="SYSTEM: X% elapsed, move to phase Y…")` at phase boundaries and 25/50/75/90% marks; hard wrap-up at ~95%.

### 5.3 GitHub on-demand tools (`@function_tool`)
- `list_candidate_repos()` — from cached snapshot, no API call
- `fetch_readme(repo)` — truncated ~3k chars
- `fetch_file(repo, path)` — truncated ~4k chars, skip binaries/huge files
- `search_repo_code(repo, query)` — top 3 snippet matches
- `list_repo_tree(repo)` — paths only

Code-enforced budgets: max N fetches per interview, per-call truncation. Each tool speaks a varied bridge line ("Let me peek at that repo…") via `agent.say()` before awaiting, so silence stays < ~1s.

## 6. Report & Grading

After finish: API sends transcript + phase metadata to Groq (REST, JSON-mode) with a grading rubric prompt.

- **Dimensions (0–10 each):** technical accuracy, depth of knowledge, communication & clarity, problem-solving, project/repo understanding
- **Overall grade:** weighted average → A+ (≥90), A (80–89), B+ (70–79), B (60–69), C+ (50–59), C (40–49), D (<40)
- **Output:** strengths list, specific improvement areas, question-by-question review (question → how the answer rated → what a stronger answer looked like)
- Stored in **reports**, rendered at `/interview/[id]/report`

## 7. API Surface (FastAPI)

```
POST /api/onboarding/profile          PUT  /api/onboarding/resume (multipart)
POST /api/github/oauth/start          GET  /api/github/oauth/callback
GET  /api/me                          GET  /api/presets
POST /api/interviews                  → { session_id, room_name, livekit_token }
GET  /api/interviews/{id}/report
GET  /internal/candidate-context/{id}     (agent-only, X-Service-Key)
POST /internal/interviews/{id}/finish     (agent-only)
```
Next.js calls the API server-side, forwarding the Clerk JWT; FastAPI verifies it → `clerk_id`.

## 8. Milestones (each ends demoable)

- **M0 — Purge & scaffold**: delete `client/`, `server/`, `python/`; monorepo skeleton, env templates, Dockerfiles, Supabase project wired.
- **M1 — Auth + Onboarding**: Clerk in Next.js, middleware gate, 3-step onboarding UI, profile + resume upload/parse/summarize, GitHub OAuth + snapshot caching.
- **M2 — Dashboard + session plumbing**: topic input, presets, duration picker, `POST /interviews`, token minting, bare interview page joining the room.
- **M3 — Voice loop**: agent worker with Deepgram STT/TTS + Groq LLM, static prompt — end-to-end talking interview.
- **M4 — Agent brain**: candidate context injection, phase engine, time reminders, hard stop.
- **M5 — GitHub tools**: the 5 tools + bridge lines + budgets.
- **M6 — Interview polish**: transcript UI, timer, visualizer, end flow, transcript persistence.
- **M7 — Report & grading**: Groq evaluation pipeline, report page.
- **M8 — Deploy & demo prep**: Vercel (web) + Docker (api, agent), LiveKit Cloud env, demo script.

## 9. Locked Decisions

- Keep **Clerk** for auth (Supabase used only for DB + Storage, not Supabase Auth).
- Separate FastAPI service from the agent worker.
- Context passed to the agent **by reference** (`context_id`), not by value.
- LiveKit **Cloud free tier**; English only.
- Hackathon rule: struggling component → 2–3 attempts → ON HOLD + tell user + suggest alternative.
- Project name stays **InterviewME**.
