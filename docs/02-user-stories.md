# Yaadein — User Stories

**37 stories · 25 P0 · 6 epics · 4 personas**
Live artifact (interactive, with progress tracking): https://claude.ai/code/artifact/9df10b59-7214-43fd-9585-ef739273b69e

## Personas

- **Savita, 78** — resident, primary user. Mild-to-moderate dementia. Marathi with Hindi/English mixed. Hard of hearing. Voice only.
- **Meena, 49** — daughter, Pune, visits fortnightly. Guilt, no visibility.
- **Arjun, 22** — grandson. Loves his Aaji, dreads visits, doesn't know what to say.
- **Latha, 34** — activity coordinator. 40 residents, ~10 hrs/week for 1:1 work.

## How a session flows

**BEFORE** — identify resident (retrieval hard-scoped) → load open loops by name → apply topic policy (banned memories filtered before the model sees them) → stage openers ranked by revisit queue.
**DURING** — open with a proposal, never a blank floor → state–pause–follow (elder-tuned VAD, 5–8s) → acknowledge within 300ms → yield to her tangent → give, never test.
**AFTER** — extract memories (provenance grade + audio offsets) → check variance (conflicts versioned, `UNRESOLVED`, memoir-blocked) → route conflicts to family → evaluate contract → publish memoir + briefing + digest.

Pipeline: voice → Saaras v3 (codemix, tuned VAD) → Sarvam-30B (tools) → memory store → Bulbul v3 (pace 0.85) → outputs.

---

## Epic A — The session (Voice Experience, 2.5×)

*The agent leads the floor and never leads the answer. Agent-initiated, elder-authored.*

**A1 · P0 — Speak, don't navigate.** Session opens with a spoken greeting, no tap. `language_code=unknown`, `mode=codemix`, no language picker. Hands-free start to end.

**A2 · P0 — Let me finish my sentence.** Silence window ≥5s when last utterance ended mid-clause or on a filler (matlab, woh, kya kehte hain); tightens to ~800ms after complete clauses. Tuned via `negative_frames_window` / `negative_frames_count` / `vad_threshold`. **Test:** 8s mid-sentence pause → zero interruptions.

**A3 · P0 — Never leave me in silence.** Pre-rendered acks (achha…, haan…) within 300ms of transcript-final. Backchannel = Realtime Fast; memory-bearing speech = Realtime Accurate. No gap >500ms.

**A4 · P0 — Say it again, the same way.** "kya? phir bolo" → identical words at pace≈0.7, louder. Never rephrase. Handles 3 consecutive repeats without frustration cues.

**A5 · P0 — Let me tell it again.** Repeated stories received warmly as if new — never "you told me this." New details silently diffed into the existing memory. **Test:** same story 3× → 3 warm receptions, 0 duplicate records.

**A6 · P0 — Yield the moment I have something to say.** Leading is the default state, not a lock. Her tangent wins; the plan becomes an open loop. Barge-in without losing context. "No wait, actually…" corrects the stored fact.

**A9 · P0 — Never hand me a blank floor.** Concrete proposals, never open questions ("Shall we stay with the wedding, or the mango tree?"). Statements she can react to over questions she must answer — recognition survives longer than recall. Every turn ends with a handhold (binary / yes-no / agreeable statement). Re-anchors each turn. Adaptive funnel: starts closed, widens while she flows, narrows on stall. **Test:** zero turns end without a handhold.

**A7 · P1 — Pick her voice.** Three Bulbul speakers auditioned at onboarding, chosen by voice, stored with pace/gain prefs.

**A8 · P1 — Say our names right.** Per-family pronunciation dictionary (names, villages, nicknames, deities); family corrects and hears the fix replayed.

---

## Epic B — Memory integrity (Memory & Context, 1×)

*Every fact traceable to the second of audio — and graded by how she gave it, because an agent that talks more must meet a stricter standard of evidence.*

**B1 · P0 — Remember what I told you last time.** `[RESUMED]` Fresh process, empty context; memory from store only. Reopens ≥1 thread by name in the first 30 seconds.

**B2 · P0 — Don't make things up about me.** `[CAPTURED]` Provenance required: `USER_STATED / FAMILY_SUPPLIED / DOCUMENT_EXTRACTED / FAMILY_VERIFIED / DISPUTED / AGENT_INFERRED`. `AGENT_INFERRED` never spoken as fact, never in memoir. "Why did you say that?" plays the original clip.

**B3 · P0 — I'm the one who knows.** On conflict the agent states uncertainty and asks her to rule. Losing version retained. A disagreement is a correction, never a failed recall.

**B4 · P0 — Fix it everywhere.** One correction updates memory + memoir paragraph + timeline. Prior value `SUPERSEDED` with timestamp/reason, visible history. **Test:** "1975, not 1974" → 3 artifacts update, old value inspectable.

**B5 · P0 — Keep her story hers.** Resident switch = explicit identification; retrieval hard-scoped. **Test:** resident B cannot surface any of A's memories by any query.

**B7 · P0 — Agreeing with you isn't the same as telling you.** Graded types: `USER_STATED` (volunteered) / `USER_CONFIRMED` (agent proposed, she agreed) / `USER_ELABORATED` (added beyond proposal) / `USER_CORRECTED` (overruled agent). Bare `USER_CONFIRMED` cannot carry a memoir claim until corroborated. Agent may only surface stored, attributed facts. `USER_ELABORATED` feeds `ENGAGED`. **Test:** agent-proposed detail she merely agrees to stays out of the memoir until corroborated.

**B8 · P0 — Different answers aren't a defect.** Same question, different answers across sessions (2, 3, 4 children) → every version stored, none overwritten; `UNRESOLVED`; memoir-blocked; zero in-session reaction. Variance may mean a child who died, a stepchild, an estrangement. Once flagged, never re-asked — safe deepening only: enumerate the known and pause. **Test:** 3 conflicting answers → 3 versions, 0 corrections, no memoir claim.

**B9 · P0 — Ask the family, never her.** `UNRESOLVED` flags route to the guardian. Family answer sets `FAMILY_VERIFIED` with context ("four; Anil died 2009" also flags Anil deceased/unpromptable). She is the authority on her experience; family on external fact. Settled questions never asked again. **Test:** resolved conflict never resurfaces with her; memoir uses verified version, her tellings preserved.

**B6 · P1 — Add what she can't tell you.** Family submissions = `FAMILY_SUPPLIED`, offered as topics, promoted only by her confirmation. English → colloquial Marathi via Mayura.

---

## Epic C — Safety & consent (Delight floor)

**C1 · P0 — Respect a closed door.** "I don't want to talk about that" → accepted in one line, no why, no retry; topic demoted permanently.

**C2 · P0 — Notice when I go quiet.** `[SAFE]` Withdrawal / sharp affect change / repeated deflection → soft pivot, auto-demote, logged without interpretation.

**C3 · P0 — Enforce it in retrieval, not in a prompt.** Policy states `ENCOURAGED → NEUTRAL → ASK_PERMISSION → AVOID → NEVER_MENTION`. `AVOID`/`NEVER_MENTION` filtered at retrieval — the model never sees them. Family-configurable, audited.

**C4 · P0 — Give me the answer, don't test me.** Missing recall answered immediately: "It was the Hanuman temple — you told me last week." No hint-laddering, no scoring, no correcting. Errorless by construction.

**C6 · P0 — Never say what we know is false.** `[SAFE]` No assertions the store contradicts — no engineered confrontations ("how are your four children?"); confident falsehoods get adopted, not caught (elevated suggestibility). No unsourced details, attribution always. Reality-orientation practice, if ever wanted, is a gated supervised feature (one caregiver-approved useful-today fact, errorless, auto-disabled on distress) — never autonomous, never her biography. A deliberate falsehood = contract failure.

**C5 · P1 — Be honest with me.** `DISPUTED` surfaced as disputed, both versions. No reassurance before classification.

---

## Epic D — The family outcome (Delight + Impact)

**D1 · P0 — Tell me what to talk about.** `[WRITTEN]` Pre-visit briefing: what to ask / she wants to finish / avoid today / what's new. Under 60 seconds, derived entirely from provenanced memories.

**D2 · P0 — Tell me something I didn't know.** First-time-disclosed memories flagged as new to family; her original audio playable inline.

**D3 · P1 — Let my grandchildren read it in English.** Sarvam Translate chapter; original language + audio preserved; citation per paragraph; no invented detail, no auto-resolved contradictions.

**D4 · P1 — Finish what she started.** `[CLOSED]` Open loops queued with reasons; each session closes ≥1 or re-queues explicitly.

---

## Epic E — Coverage (JTBD + Impact)

**E1 · P0 — Zero prep.** No coordinator input between sessions; life story accumulates automatically; runnable by any staff member with a tablet.

**E2 · P0 — Show me it worked.** Session Contract evaluated + displayed live; failures name the unmet condition. **Test:** 3 consecutive sessions, 3 personas, all six lines green, no intervention.

**E3 · P0 — Show me she's engaging.** `[ENGAGED]` Speaking time, turn count, spontaneous elaborations, affect markers — trended, framed as observation for caregivers, never a cognitive score. Changes flagged for human review, never interpreted.

**E4 · P1 — Escalate only exceptions.** Digest ranks by flags (distress, engagement drop, disputed facts); clean sessions need no review.

**E5 · P1 — Seed from what the family already has.** Sarvam Vision on a wedding invitation → `DOCUMENT_EXTRACTED` cues requiring her confirmation; agent opens with it next session.

**E6 · P2 — Record a family session.** Batch STT + diarisation; provenance per speaker.

---

## Epic F — Guardian cues (promoted from P2 per official PS — visual memory support is a success criterion)

**F1 — Describe the photo to me.** Guardian uploads photo + context (who/where in frame, when, where, event). Vision reads it; the agent **describes it aloud** while the photo **fades in on the resident screen** (voice-first, not voice-only — she may not see well). Facts = `DOCUMENT_EXTRACTED`/`FAMILY_SUPPLIED` cues, never truth.

**F2 — Know who has died.** Upload flow **requires** deceased flags per person + whether she knows. Deceased people: past tense, never used as prompts, never asked about — unless she raises them, then follow with warmth. Unresolved deceased status ⇒ material held back.

**F3 — Questions with no wrong answer.** The agent states what the guardian supplied — never asks for facts it holds. Not "kiski shaadi thi?" but "Meena ki shaadi thi." *(pause)* Questions target feeling/impression/open narrative: "us din ka khaana kaisa tha?", "kaun sabse zyada naacha?", "photo ke baad kya hua?" One question per turn. On stall, the agent answers its own question and moves on. Conflicts with guardian data → `DISPUTED`, never corrected aloud.

---

## Additions required by the official problem statement (fold into Phase 3)

- **Revisit scheduler:** each memory carries `last_visited`, `visit_count`, `response_quality`, `next_due`; joy-weighted; cool-down prevents same-week repeats. ("Revisit at appropriate intervals to reinforce recall.")
- **Passive recall trajectory:** provenance grade per visit; `ELABORATED → CONFIRMED` downgrade trend = getting harder → revisit sooner with more scaffolding. Never elicited, only observed. ("Track whether a memory is becoming easier or harder.")

---

## Definition of done

**Rubric mapping:** JTBD L4–L5 (E1 E2 E3) · Voice L4–L5 (A2 A3 A4 A5 A6 A9) · Memory L5 (B4 B5 B7 B8 B9 C3) · Creativity L4–L5 (B3 B7 B9 D1) · Impact L4 (E1 E3) · Delight L4 (C4 C6 D2).

**Ship gate:** 3 full sessions, 3 personas, 2 languages, back to back, keyboard untouched. If any of A2, A5, A9, B1, B4, B5, B7, B8, C4, C6 fails — fix before any P1 work.

**The kicker:** A9 (never hand her a blank floor), A2 (let her finish), C4 (give her the answer) decide whether it feels human. B7/B8 decide whether it's honest. The agent carries the conversation so she never has to — and the provenance layer is what stops it from carrying her story away from her.
