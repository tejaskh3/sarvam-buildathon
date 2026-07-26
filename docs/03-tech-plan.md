# Yaadein — Technical Build Plan

**Stack:** Next.js (full-stack, one repo) + Node WS relay + Postgres + Sarvam APIs.
Run **localhost for the demo**; Vercel deploy is backup only. The voice loop needs a persistent WebSocket relay between browser and Sarvam — simplest as a long-lived local Node process, and the stage demo must not depend on a cold serverless function.

```
Browser (mic + speaker + photo panel + scoreboard)
   │  WebSocket (PCM16 audio up / audio chunks down)
Node relay server
   ├─► Saaras v3 STT WS        (tuned VAD)
   ├─► Sarvam-30B chat          (tools + structured output)
   ├─► Bulbul v3 TTS WS         (streaming out)
   └─► Postgres                 (the product)
Background jobs: extraction · contract eval · memoir · briefing
```

## Keys & integrations (get all on day one, in `.env`)

| Key | Used from | How to get |
|---|---|---|
| `SARVAM_API_KEY` | Phase 0 onward — everything | dashboard.sarvam.ai → API key. Ask organizers for hackathon credits + a rate-limit bump for demo day |
| `DATABASE_URL` | Phase 2 onward | Local Docker Postgres (zero signup) — or Neon free tier as cloud backup |
| Audio storage | Phase 2 onward | **Local disk** `/audio/{session}/{turn}.wav`. No key. No S3/Blob at a hackathon |
| Vercel (optional) | Phase 7 backup | `vercel login` — no key in code |

**One paid key total.** No OpenAI/Anthropic/ElevenLabs — Sarvam-only is both constraint and pitch.

---

## Phase 0 — Skeleton & smoke tests (~2–3 hrs)

De-risk every Sarvam endpoint before building on it.

1. Scaffold: `create-next-app` + `server/` dir for WS relay (Node + `ws`)
2. `scripts/smoke.ts`, in order:
   - REST STT: 10s Hindi WAV → transcript (`saaras:v3`, `mode=codemix`)
   - Chat: Sarvam-30B with a dummy tool definition → verify tool calling
   - Structured output: JSON-schema call → verify validation
   - REST TTS: Bulbul → WAV to disk (listen — is `pace=0.85` right?)
3. Open **both WebSockets** (STT + TTS) once, log frame shapes — pull exact URLs/params from docs.sarvam.ai
4. Commit `.env.example`

**⛔ Gate:** one script runs audio → transcript → LLM → audio end-to-end; a teammate has heard it. Every API returned 200.

**Keys:** `SARVAM_API_KEY` only.
**Check now:** which languages Bulbul v3 actually sounds good in — pick the 2 demo languages today, by ear.

---

## Phase 1 — The realtime voice loop (~8–10 hrs, longest phase)

Everything else is worthless if she gets interrupted. (Stories A1–A6, A9 plumbing.)

1. **Mic capture:** AudioWorklet → 16kHz mono PCM16 → relay WS (not MediaRecorder — raw frames for latency)
2. **Relay → Saaras WS:** `language_code=unknown`, `mode=codemix`, and the whole point — **VAD params**: widen `negative_frames_window` / `negative_frames_count` until an 8-second mid-sentence pause survives. Make all three a live-tunable config panel
3. **Adaptive endpointing:** trailing fillers (`matlab`, `woh`, `kya kehte hain`) or mid-clause endings → hold window long; complete clause → tighten. ~50 lines of heuristics on top of Sarvam VAD. This is the Voice L5 story
4. **Ack bank:** pre-render 6–8 clips (`achha…`, `haan haan…`) with Bulbul at build time; play within 300ms of transcript-final while the LLM call is in flight
5. **Sarvam-30B streaming** → sentence buffer → **Bulbul WS** → stream to browser
6. **Barge-in:** speech during TTS playback → kill playback instantly, keep interrupted text as context
7. Latency instrumentation on every hop

**⛔ Gate:** teammate holds a 3-minute code-mixed conversation: (a) 8s pause never interrupted, (b) never >500ms dead air, (c) barge-in works. **Record it — fallback demo video.**

**Risk:** always overruns. Do not start Phase 2 until this gate passes.

---

## Phase 2 — Memory store & extraction (~5–6 hrs)

1. **Schema** (Postgres, docker-compose):

```sql
residents(id, name, language, voice_id, pace)
sessions(id, resident_id, started_at, contract jsonb)
memories(id, resident_id, statement, canonical, provenance,      -- USER_STATED..AGENT_INFERRED
         emotional_tone, sensitivity, people jsonb, places jsonb,
         time_ref jsonb, audio_path, audio_start_ms, audio_end_ms,
         superseded_by, status)                                   -- ACTIVE|SUPERSEDED|UNRESOLVED|DISPUTED
memory_versions(memory_id, value, session_id, recorded_at)        -- B8 variance
open_loops(id, resident_id, topic, why_open, status)
topics(resident_id, topic, policy)                                -- ENCOURAGED..NEVER_MENTION
revisit_queue(memory_id, last_visited, visit_count, response_quality, next_due)
family_queue(id, resident_id, question, answers jsonb, resolution) -- B9
```

2. **Extraction worker:** after each user turn, async low-temp Sarvam-30B call with the memory JSON schema (structured outputs) → graded rows. Never blocks the voice loop
3. **Provenance grading:** agent proposed the fact this turn → `USER_CONFIRMED`; she added beyond it → `USER_ELABORATED` (compare against agent's last utterance)
4. Per-turn audio to disk with offsets; `GET /memories/:id/audio` → clip
5. Minimal inspector page: memory list, provenance chips, ▶ play. This is the "Why did you say that?" demo screen

**⛔ Gate:** after a Phase-1 conversation, inspector shows ≥3 correctly graded memories; clicking one plays the exact seconds it came from.

**New:** `DATABASE_URL` (Docker — no signup).

---

## Phase 3 — Continuity: retrieval, open loops, scheduler (~4–5 hrs)

The "next week" beat.

1. **Tools for Sarvam-30B:** `search_memories`, `save_memory`, `get_open_loops`, `mark_topic_state`. Keyword + people/places match — skip embeddings unless retrieval visibly fails
2. **Session opener (BEFORE phase):** resident → open loops → policy filter → revisit queue → opening proposal, named thread, never a blank floor
3. **Revisit scheduler:** `next_due = f(response_quality, visit_count)`, joy-weighted, 1-session cool-down. Passive recall trajectory: store provenance grade per visit; a downgrade trend (`ELABORATED → CONFIRMED`) = getting harder → revisit sooner with more scaffolding
4. **Cold-start discipline:** new session = empty LLM context, everything through tools. `--fresh` flag proves it

**⛔ Gate:** kill server, restart, start session — agent reopens the unfinished story **by name** in the first exchange; revisit queue shows due-dates.

---

## Phase 4 — Governance: the judge-attack phase (~4–5 hrs)

Each item is a specific attack a judge will run. Build each as a re-runnable test.

1. **Topic policy at retrieval:** `AVOID`/`NEVER_MENTION` filtered in SQL, not prompt. Family toggle UI
2. **Correction propagation (B4):** "actually 1975" → fact updated → old value `SUPERSEDED` → memoir paragraph + timeline regenerate → version history visible
3. **Variance (B8):** conflicting fact → `memory_versions` row + `UNRESOLVED` + memoir block + `family_queue` entry. Agent says nothing
4. **Family resolution (B9):** answer → `FAMILY_VERIFIED` + context (deceased flags) → question retired forever
5. **Isolation (B5):** resident switch = new scope; test 5 cross-resident queries → zero leakage
6. **C6 guard:** post-generation check — response contradicts store → block + regenerate. Distress heuristics (deflection ×2, sharp tone shift) → pivot + demote topic

**⛔ Gate:** scripted attack suite passes: correction propagates to 3 artifacts · conflicts version silently · resident B can't see A · avoid-topic never surfaces · false assertion caught. Re-run on every commit after this.

---

## Phase 5 — Outputs: contract, briefing, memoir (~4–5 hrs)

1. **Contract evaluator:** end-of-session job scores `RESUMED / CAPTURED / CLOSED / WRITTEN / SAFE / ENGAGED` from DB queries. **Live scoreboard component** — this sits on the projector
2. **Sunday briefing:** template + one Sarvam-30B call → ask about / wants to finish / avoid today / nobody knew this ("new to family" = first-occurrence facts)
3. **Memoir chapter:** Sarvam-105B, input = only `ACTIVE` non-blocked memories, grade ≥ corroborated; hard rules (no invented detail, disagreements stated, citation per ¶ with audio links)
4. **One translated chapter** (Sarvam Translate) + optional Bulbul narration
5. Coordinator digest: contract results + flags

**⛔ Gate:** one full session auto-produces all four artifacts; scoreboard went green live, keyboard untouched.

---

## Phase 6 — Photos & guardian portal (~3–4 hrs)

PS-compliance. Exactly one flow.

1. Guardian upload: photo + required context (who/where in frame, when, where, event, **deceased flags + does-she-know**). Unresolved deceased status ⇒ photo held back
2. **Sarvam Vision** parse → `DOCUMENT_EXTRACTED` cues (her confirmation promotes them)
3. **In-conversation display:** topic links to photo → fade in on resident screen **and** describe aloud (F1). Questions per F3: state facts, ask only no-wrong-answer questions

**⛔ Gate:** upload wedding photo + context → next session the agent raises it, photo appears mid-conversation, description spoken, confirmation promotes facts.

---

## Phase 7 — Hardening & demo rehearsal (~5–6 hrs, never skip)

1. Seed **3 personas** in 2 languages with pre-built histories
2. Run the **ship gate**: 3 full sessions back-to-back, keyboard untouched, contract green
3. Latency pass; venue-WiFi test with phone-hotspot fallback
4. Failure drills: Sarvam 429/timeout → retry, ack bank covers the gap; WS drop → auto-reconnect
5. Record the golden run as backup video; write the 6-minute script with named roles
6. Optional: `vercel deploy` as second-machine backup

**⛔ Gate:** ship gate passes twice in a row; golden run recorded on two laptops.

---

## Budget & sequencing

**Total ~36–44 focused hours.** For a 24-hour hackathon with 3–4 people: Phases 0–1 serial (everyone unblocks on the voice loop), then split — memory (2+3), governance (4), outputs/photos (5+6). Phase 7 is the whole team, last 4 hours, non-negotiable.

**If time collapses, cut from the bottom, never the top:**
voice loop → memory+continuity → contract scoreboard → correction/variance → briefing → photos → memoir translation.
