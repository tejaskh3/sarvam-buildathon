# Epoch Submission Pack — Yaadein

Live: **https://www.yaadeinapp.com**
Try it: `#/try` · Family dashboard: `#/family` · Live usage: `#/stats`
Demo number for judges: **1234567890** (shared) — or register any 10-digit number.

---

## 1. One paragraph

India has 8.8 million people over 60 living with dementia. The treatment that
works isn't a drug — it's conversation: cognitive stimulation and reminiscence
therapy, ranked first among cognitive interventions in a 2025 meta-analysis.
Almost no Indian family can get it, because it needs a trained facilitator who
speaks the elder's language, every week, forever. India has fewer than 50
specialised dementia centres and a shortage of 4.3 million professional
caregivers. **Yaadein fills the prescription the doctor writes but nobody can
staff:** a ten-minute voice conversation every day, in the elder's own
language, that leads the conversation, remembers what was said, brings it back
gently, and never once tests them. The family gets the first honest picture of
how things are going — and a care centre gets its session notes written for it.

**Positioning line:** *India's first AI voice companion for dementia — daily
reminiscence therapy in her own language for ₹50 a day, when the alternative is
a ₹40,000-a-month attendant who doesn't speak it.*

---

## 2. Criterion 1 — Sarvam models drive the product

Sarvam is not a feature here; it is the only reason the product can exist. No
other AI vendor is used anywhere in the stack.

| Sarvam capability | What it does in Yaadein | Why the product dies without it |
|---|---|---|
| **Saaras v3** (STT, `codemix`) | Every elder utterance; also every chunk of a recorded human therapy session | Elders speak Hindi/Kannada/Marathi with code-mixed English, in noisy rooms, slowly. Generic STT fails this speaker profile. |
| **Sarvam-30B** (chat) | Leads the conversation, runs the CST activity, extracts structured memories in parallel | The therapy IS the conversation. `reasoning_effort: null` keeps voice turns ~0.4s. |
| **Sarvam-105B** (chat) | Two delicate jobs: the stalled-memory cue, and the clinical session note | 30B either quizzed the elder or blurted the answer; 105B holds the constraint. Verified difference. |
| **Bulbul v3** (TTS, `simran`, pace 0.85) | Yaadein's voice, in 11 languages | A soothing voice at elder-appropriate pace is the product's whole surface. |
| **Sarvam Translate** | Opens the session in the elder's language; renders the memoir in English for the family | Sarvam-30B would not reliably open in Marathi from an empty history — Translate made it deterministic. |

**Deliberately not used:** no vector database, no embeddings, no other LLM. At
300 memories per elder, full-context beats top-k retrieval, and our hard
problems (contradiction detection, provenance, recall trajectories) are ones
embeddings are actively bad at. See D-series decisions in DECISIONS.md.

---

## 3. Criterion 2 — Live and production-ready

- Hosted on Railway, single Node process serving both the app and the API.
- **Persistent volume** mounted at the data directory — memories survive every
  deploy and restart (verified: a persona created before a redeploy was still
  there after).
- **Self-serve**: anyone registers with a 10-digit number and starts talking.
  Family sign-in/sign-out via Clerk protects the dashboard; the elder never signs
  in, by design — it switches on with one env var.
- **Zero npm dependencies** in the backend — Node built-ins only, including
  hand-rolled JWT verification (Clerk JWKS) and webhook signature verification
  (Dodo). Nothing to patch, nothing to break.
- **17-test adversarial regression suite** (`node scripts/attack.mjs`) run
  against production before every deploy. Green.
- Graceful failure: upstream credit/rate limits surface as an honest message,
  not a broken app. Session GC, signup rate limiting, machine-readable errors.

## 4. Criterion 3 — Traction

Live counters, public and unseeded, at `#/stats` (`/api/stats`):
families · elders · voice sessions · minutes of real conversation · memories
kept · activity rounds · human sessions documented · languages spoken.

*(Fill in the final numbers at submission time from the live page — screenshot
it rather than quoting it here, so the number is verifiable.)*

Channels used: caregiver WhatsApp/Facebook communities (Caregiver Saathi,
Dementia Care Notes, ARDSI support groups), and direct outreach to dementia day
care centres — Nightingales Medical Trust Bangalore (3 day cares), Dementia
India Alliance, Samvedna Care. Pilot letter of intent: see attached.

## 5. Criterion 4 — Business

**The market's own numbers.** Dementia costs an Indian household ~$571/year —
about 20% of what the government spends on health per capita (AEA/LASI 2024);
urban families spend ₹45,600–₹2,02,450/year, and informal family care is about
half of that cost. A trained dementia attendant starts at ₹40,000/month;
Bangalore memory day-care runs ₹25,000–₹85,000/month. Yaadein at ₹1,499/month
is ~2–3% of the cheapest alternative, and it's the only one that shows up every
single day.

**Pricing (live on the site):**
- **Founding Family — free** (first families, forever)
- **Family — ₹1,499/mo** — daily companion, family dashboard, memory book
- **Care Centres — ₹600/seat/mo** — Session Scribe, member roster, white-label family reports

**Why the B2B line matters:** every global analogue that survived (LifeBio,
MyndYou) stuck through institutions, not consumers. A centre charging
₹30–60k/month absorbs ₹600/seat without thinking, and what they actually buy is
documentation their one psychologist currently writes by hand.

**Who pays:** the adult child, often in another city, who is already spending
this money and carrying the guilt. Note the cultural wedge: caregivers crave
respite but refuse outside help ("log kya kahenge"). A voice companion isn't an
outsider in the home and isn't abandonment — *care that stays in the family.*

**Note on positioning:** 90% of Indian dementia is undiagnosed and half of
families call it normal ageing, so the consumer face is *a memory companion for
ageing parents*. The recall tracking is what surfaces the diagnosis
conversation — the product creates its own diagnosed market.

## 6. Criterion 5 — Technical depth

Not API stitching. Five things that are ours:

1. **Provenance-graded memory graph.** Every fact carries how it was given
   (STATED / CONFIRMED / ELABORATED / CORRECTED / FAMILY_VERIFIED /
   SESSION_OBSERVED) and its history across visits. A memory sliding from
   ELABORATED to bare CONFIRMED over weeks is a signal, observed passively —
   never elicited by a test.
2. **Contradiction quarantine with family arbitration.** "Two children" last
   week, "three" today: both versions are kept, the fact goes UNRESOLVED and
   out of the agent's reach, and the family — not the elder — settles it. The
   elder is never corrected.
3. **Speech-latency biomarkers.** The browser measures the gap between the end
   of Yaadein's question and the elder's first voiced frame; ≥4s is flagged.
   This is grounded in published work: silent-pause analysis of connected
   speech tracks cognitive decline, and dementia is detectable from
   voice-assistant interaction patterns.
4. **The game is also the instrument.** The naming activity ("let's go to the
   sabzi mandi") silently counts what she lists. Semantic verbal fluency is one
   of the oldest dementia screens — so each round administers a validated
   measure while she plays. She is never told a number.
5. **Safety enforced in code, not prompts.** Prompt rules leaked every single
   time we relied on them, so the guards are executable and tested: banned
   recall-test phrases with surgical rewrite, a repetition guard (the model
   re-asked one question four turns running before it existed), a dangling
   "you told me that…" stripper, and a cue-leak guard that regenerates any hint
   that restates the fact the elder was reaching for.

---

## 7. Demo script (5 minutes)

| Time | Show | Say |
|---|---|---|
| 0:00 | Black screen | The personal opening: dementia in the family, three generations. |
| 0:20 | The numbers | 8.8M Indians over 60. Therapy exists; it's conversation. Fewer than 50 centres, 4.3M caregivers short. |
| 0:45 | `#/try`, enter the number, talk | Live, in Hindi. Let it lead. Show it probing a detail, not testing. |
| 1:30 | Refresh, start again | It greets her by name and reopens the unfinished story — memory across sessions. |
| 2:00 | **The cue moment** | Say "mera beta… kya karta hai woh… yaad nahi aa raha." It comforts, then hints — never the answer. Then the recovery: "Haan! Doctor!" |
| 2:45 | `#/family` → Visit briefing | Sixty seconds before you walk in. Point at "Nobody knew this." |
| 3:15 | Alerts & trends | The questions that took time to answer, and the word-fluency chart: *the game is the therapy and the measurement.* |
| 3:45 | Session notes (Scribe) | Record 20 seconds of your own voice, stop, show the doctor-ready note. This is what a day-care psychologist writes by hand today. |
| 4:15 | Photos tab | Upload → next session opens with the photo. Show the required "who has passed away?" field: the safety gate. |
| 4:40 | `#/stats` + pricing | Real usage, ₹50/day vs ₹40,000/month, and the ₹600/seat centre line. |

**Do not** improvise a new elder mid-demo (a first session has no memory to
show). Use a seeded persona on a private number, and don't redeploy after
seeding.

## 8. Honest limitations (say these before a judge finds them)

- Cognition claims: we claim adherence and engagement, **not** proven cognitive
  improvement. The definitive home-CST trial was null because family delivery
  collapsed; our claim is that an always-available agent removes that failure.
- Not a medical device. No diagnosis, no treatment advice — the session note
  says so on its face.
- No wandering/GPS, no night care, no help with bathing or feeding. Those are
  real caregiver pains we deliberately don't claim.
- Latency thresholds (4s/7s) are first estimates; they need tuning against real
  elders, whose baseline pauses are longer than ours.
- Non-numeric contradictions ("Pune" vs "Nagpur") coexist rather than flag.
- One number = one elder today. Multi-elder households arrive with real auth.
