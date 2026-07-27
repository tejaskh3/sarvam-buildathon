# Yaadein — Docs

Voice-led AI memory companion for people living with dementia. Sarvam Buildathon, July 2026.

| Doc | What's in it |
|---|---|
| [01-product-brief.md](01-product-brief.md) | The final idea: what we're building, principles, Session Contract, rubric strategy, demo spine, claims discipline |
| [02-user-stories.md](02-user-stories.md) | 37 stories, 6 epics, acceptance criteria, ship gate. Interactive version: [artifact](https://claude.ai/code/artifact/9df10b59-7214-43fd-9585-ef739273b69e) |
| [03-tech-plan.md](03-tech-plan.md) | 8 phases (0–7), each with a hard "finished" gate, keys/integrations per phase, cut order |
| [04-positioning.md](04-positioning.md) | Competitive landscape, what didn't exist before, judge attacks & answers, PS alignment |
| **[05-epoch-sprint-plan.md](05-epoch-sprint-plan.md)** | Top 15 → Top 10 sprint: phases, file ownership, frozen API contract, merge order, outreach kit |
| **[06-market-research.md](06-market-research.md)** | 4 deep-research reports condensed: competitors & pricing, caregiver pain, B2B channel with phone numbers, evidence base with citations |
| **[07-keys-and-accounts.md](07-keys-and-accounts.md)** | Tejas-only runbook: Dodo KYC, Clerk sign-in, the env vars to paste into Railway |
| **[08-submission.md](08-submission.md)** | Submission pack: criterion-by-criterion answers, 5-minute demo script, honest limitations |
| [DECISIONS.md](DECISIONS.md) | Every autonomous call taken during the build (D1–D17), with the reasoning and known limits |

## The idea in three lines

The agent **leads every conversation** (she never has to carry one) but may only speak facts someone actually supplied — agent-initiated, elder-authored. It **never tests her**: missing recall is answered as a gift; contradictions are versioned silently and resolved with the family, never with her. Output flows **toward the family**: a living memoir and a 60-second Sunday briefing.

## Keys (as built)

- `SARVAM_API_KEY` — everything AI (dashboard.sarvam.ai). The only AI vendor.
- `CLERK_PUBLISHABLE_KEY` + `VITE_CLERK_PUBLISHABLE_KEY` — family sign-in/sign-out.
  Optional; without them the app runs open, as it did before.
- `DODO_WEBHOOK_SECRET` + checkout URL — turns on payments. Optional.
- No database URL: SQLite via `node:sqlite`, on a Railway volume. Zero npm deps.

## Running it

```
node --experimental-sqlite app/server.js     # API + serves the built site
cd landing-page && npm run build             # build the site first
node scripts/attack.mjs                      # 17-test adversarial suite
API=<prod-url> node scripts/attack.mjs       # same suite against production
```

Deploy: `railway up --service sarvam-buildathon`. Never deploy without the
suite green and `grep -o "localhost:3000" landing-page/dist/assets/*.js` = 0.
