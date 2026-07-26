# Yaadein — Docs

Voice-led AI memory companion for people living with dementia. Sarvam Buildathon, July 2026.

| Doc | What's in it |
|---|---|
| [01-product-brief.md](01-product-brief.md) | The final idea: what we're building, principles, Session Contract, rubric strategy, demo spine, claims discipline |
| [02-user-stories.md](02-user-stories.md) | 37 stories, 6 epics, acceptance criteria, ship gate. Interactive version: [artifact](https://claude.ai/code/artifact/9df10b59-7214-43fd-9585-ef739273b69e) |
| [03-tech-plan.md](03-tech-plan.md) | 8 phases (0–7), each with a hard "finished" gate, keys/integrations per phase, cut order |
| [04-positioning.md](04-positioning.md) | Competitive landscape, what didn't exist before, judge attacks & answers, PS alignment |

## The idea in three lines

The agent **leads every conversation** (she never has to carry one) but may only speak facts someone actually supplied — agent-initiated, elder-authored. It **never tests her**: missing recall is answered as a gift; contradictions are versioned silently and resolved with the family, never with her. Output flows **toward the family**: a living memoir and a 60-second Sunday briefing.

## Keys needed (total)

- `SARVAM_API_KEY` — everything (dashboard.sarvam.ai)
- `DATABASE_URL` — Postgres via Docker (Phase 2+)
- Nothing else. Sarvam-only is the pitch.

## Before writing code

1. Phase 0 smoke tests (see tech plan) — de-risk every Sarvam endpoint
2. Call one dementia-care operator for a real prep-time baseline (Impact L3 → L4/L5)
3. Pick the 2 demo languages by listening to Bulbul v3, not by reading the docs
