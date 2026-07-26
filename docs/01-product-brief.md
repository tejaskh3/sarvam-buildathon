# Yaadein — Product Brief

**One-liner:** Yaadein is a voice-led AI companion that learns an elder's life story in her own language — and turns it into something her family can actually use this Sunday.

**Technical one-liner:** Every team will build the companion the problem statement describes. We're also building the part it doesn't ask for: a memory system that keeps honest books — graded evidence, versioned contradictions, family arbitration — so what it remembers can be trusted with someone's life story.

## What it is

A voice-led daily 10-minute conversation for a person with dementia, in her own code-mixed language (Marathi/Hindi/English mid-sentence). The agent **initiates and carries** every conversation, accumulates her life story into a provenance-graded memory store, and produces three outputs:

1. **Living memoir** — chapters in her language, source citation per paragraph, translated for grandchildren
2. **Sunday briefing** — 60 seconds for the family before a visit: what to ask, what she wants to finish, what to avoid today, what nobody knew
3. **Coordinator digest** — session pass/fail, engagement trend, exceptions only

**She never operates anything. She only talks.** The tablet shows a photo when the conversation reaches one; the agent describes it aloud too (voice-first, not voice-only).

## Who pays / who benefits

- **Payer:** dementia day-care centres and assisted-living homes. One coordinator : ~40 residents; personalized reminiscence needs ~35 min prep per resident per session, so only ~6 of 40 get it. Yaadein takes prep to zero. **6 of 40 → 34 of 40.** *(Numbers are placeholders — call one operator for a sourced baseline before demo day.)*
- **Users:** the elder (dignity, engagement) · the coordinator (coverage) · the family — especially the grandson who dreads the visit because he doesn't know what to say.

## Core principles

1. **Lead the floor, never lead the answer.** Agent-initiated, elder-authored. Open questions are executive-function tasks she can't do; leading questions manufacture memories (suggestibility is elevated in dementia). The agent proposes only facts already in the store, with attribution.
2. **She's the arbiter, not the subject.** We never quiz her. On conflict, the agent admits it might be wrong and asks her to rule. She is editor-in-chief of her own biography.
3. **Never test; give.** Missing recall answered immediately as a gift: "It was the Hanuman temple — you told me last week." Errorless by construction.
4. **Honest books.** Provenance grades that never merge; variance versioned, blocked from memoir, resolved with the family — never with her. The agent never asserts what the store contradicts.
5. **The memoir isn't the product — the briefing is.** A memoir gets shelved. The briefing changes what happens on Sunday.

## The Session Contract (proof instrument)

Every session passes or fails, live on screen:

```
RESUMED   reopened an unfinished thread by name
CAPTURED  ≥3 new memories with provenance + audio offsets
CLOSED    resolved or explicitly re-queued one open loop
WRITTEN   memoir chapter + briefing updated
SAFE      zero policy violations, zero failed-recall loops
ENGAGED   speaking time, turns, spontaneous elaborations — trended
```

## Claims discipline

- **Do say:** supports engagement, communication, family connection, coverage of personalized reminiscence. Engagement metrics are *observations for caregivers*, never diagnostic.
- **Never say:** slows, treats, or cures dementia. (Cochrane: small cognition effects from cognitive stimulation, stronger in milder dementia; no cure. We don't need the clinical claim.)
- We are not a therapist; we extend the trained human — briefed, flagged cases instead of blank pages.

## Rubric strategy (Sarvam buildathon)

- **Selected Sarvam parameter: Voice Experience (2.5×).** Depth beats breadth — additional APIs earn zero points. Vision/Translate/Mayura appear only where the job needs them.
- The winning engineering story: **elder-tuned VAD.** Default agents interrupt after ~500ms of silence; an elder searching for a name pauses 5–8s. We tune Sarvam's `vad_threshold` / `negative_frames_window` adaptively. "When she's searching for her sister's name, that silence *is* the conversation."
- JTBD (2.5×) proven by contract × 3 personas × 2 languages, live.
- Everything in the official problem statement is table stakes (every team has it). Our unpredictable-from-the-idea-card additions: Session Contract, provenance/variance/arbitration, the Sunday briefing, retrieval-enforced topic policy, multi-resident isolation.

## Demo spine (6 minutes)

Ratio hook → session 1 with interruptions + code-switching (scoreboard ticking) → memory forensics, play the audio → she overrules us (arbitration) → **cold-start "next week"**, reopens thread by name → "actually it was 1975" propagates live, old value superseded → two residents one device, zero leakage → photo fades in mid-conversation → briefing read aloud → cases 2 and 3 → the coverage number.

## Not building

Voice cloning (doesn't exist in Sarvam), dubbing, quizzing of any kind, clinical claims, >2 languages (perfect Hindi + one regional), diarised family recordings, transcript-mode toggles, animations.
