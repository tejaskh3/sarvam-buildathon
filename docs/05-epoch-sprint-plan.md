# Epoch Sprint Plan — Top 15 → Top 10 (22 hours)

**Team:** Tejas (UI owner) · Teammate-2 (growth/payments/testing owner) · Claude (backend owner)
**Goal:** live product, 25 real users, ≥1 pilot LOI, payments live, CST engine + Session Scribe shipped.

**Judging criteria → what covers it**
| Criterion | Covered by |
|---|---|
| 1. Sarvam models driving the product | CST engine (30b themes + 105b cues), Saaras STT everywhere incl. Scribe, Bulbul voice, Translate for openers/memoir. Every feature routes through Sarvam. |
| 2. Live, production-ready | Railway + volume (done), self-serve signup, stability pass, uptime monitor |
| 3. Real traction (25 users) | Signup flow + outreach plan (Nightingales/DIA/caregiver groups) + /api/stats proof |
| 4. Business impact | Pricing page + Dodo checkout, LOI, prescription-gap narrative (docs/06) |
| 5. Technical depth | Provenance memory graph, contradiction quarantine, latency biomarkers, CST-as-measurement, scribe pipeline |

---

## 0. Ground rules (read first — non-negotiable)

1. **File ownership is absolute.** We lost hours to FamilyPage.tsx being overwritten 4 times. Nobody edits a file outside their track. If you need a change in another track's file, ask its owner (or leave a `// TODO(owner):` and move on).
   - **Claude owns ALL code:** `app/**`, `landing-page/src/**`, `scripts/*`. Humans do not edit code files while the sprint runs — flag issues, Claude fixes.
   - **Tejas owns:** Dodo + Clerk accounts, PR review/merge, deploys, final UI polish pass (coordinated through Claude at Phase E).
   - **Teammate-2 owns:** outreach materials (`docs/outreach/*`), real-device testing, uptime monitor, tomorrow's calls + user onboarding. No code files.
2. **The API contract below is FROZEN once we start.** UI builds against it (mock with the JSON examples). Backend implements it exactly. Any change = message the group first.
3. **Branches & PRs:** `main` is always deployable. Branches: `be/<feature>`, `ui/<feature>`. PR reviewer: Tejas reviews backend PRs (sanity/scope), Claude reviews UI PRs (API usage + the localhost rule). Small PRs — one feature each. Merge order in §5.
4. **Deploys:** only Tejas runs `railway up`, only from `main`, only after `node scripts/attack.mjs` passes and `grep -o "localhost:3000" landing-page/dist/assets/*.js | wc -l` prints 0. The volume keeps data safe, but deploys restart the server (~30s outage) — don't deploy during a live user session or demo.
5. **Prod URL:** `https://sarvam-buildathon-production.up.railway.app` · Sarvam key: Railway env var `SARVAM_API_KEY` · admin numbers: `1231231239` (Tejas), `1231231238` (teammate).

---

## 1. Database changes (Claude, first commit — everything depends on it)

All in `app/db.js`, guarded `CREATE TABLE IF NOT EXISTS` / `ALTER` like existing code. **The old env-var allowlist stays as a fallback so current users don't break.**

```sql
-- self-serve registration (replaces the fixed allowlist)
CREATE TABLE IF NOT EXISTS registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL UNIQUE,          -- 10 digits
  elder_name TEXT,                     -- optional; onboarding can still learn it by voice
  language TEXT,                       -- hi-IN | kn-IN | ta-IN | ... (Bulbul codes)
  family_name TEXT,                    -- who signed up (the adult child, usually)
  source TEXT,                         -- 'web' | 'center' | 'whatsapp' — for traction reporting
  plan TEXT DEFAULT 'founding',        -- founding | family | care_plus | b2b
  created_at TEXT DEFAULT (datetime('now'))
);

-- CST engine: one row per themed activity round, silently harvested
CREATE TABLE IF NOT EXISTS engagement (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL,
  session_id TEXT,
  theme TEXT NOT NULL,                 -- kahavat | shabd_bazaar | swad | duniya | sangeet
  detail TEXT,                         -- e.g. category used: 'sabziyan'
  items INTEGER,                       -- fluency count (e.g. vegetables named) — biomarker
  enjoyed INTEGER,                     -- 0/1 heuristic from tone
  created_at TEXT DEFAULT (datetime('now'))
);

-- reminders set by family, woven into conversation
CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL,
  text TEXT NOT NULL,                  -- 'subah ki dawai nashte ke baad'
  time_of_day TEXT DEFAULT 'any',      -- morning | evening | any
  active INTEGER DEFAULT 1,
  last_mentioned TEXT,
  ack_count INTEGER DEFAULT 0,         -- times elder acknowledged
  created_at TEXT DEFAULT (datetime('now'))
);

-- Session Scribe: human-run therapy sessions, recorded → report
CREATE TABLE IF NOT EXISTS scribe_sessions (
  id TEXT PRIMARY KEY,                 -- uuid
  person_id INTEGER NOT NULL,
  facilitator TEXT,                    -- name/role typed at start
  status TEXT DEFAULT 'RECORDING',     -- RECORDING | DONE
  transcript_json TEXT,                -- [{t, text, lang}]
  report_json TEXT,                    -- structured report (schema in §3.4)
  seconds INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
```

`phoneOk()` becomes: valid 10 digits AND (in registrations table OR in the legacy env allowlist).

---

## 2. Phases (parallel tracks; integration checkpoints in bold)

### Phase A — hours 0–3
| Who | Task |
|---|---|
| Claude | DB migrations + **Registration API** (§3.1) + phoneOk rewire. PR `be/registration`. |
| Tejas | **Signup UI**: rework PhoneGate into 2-step "Get started" (number → elder name + language dropdown + how-did-you-hear). Build against §3.1 mock. PR `ui/signup`. Also: start **Dodo account creation NOW** (verification takes 2–3h and only you can KYC). |
| Teammate-2 | Outreach kit: 1-page Hindi/English flyer with QR to prod URL (Canva), WhatsApp pitch message (§6), post in 3 caregiver groups tonight. List 10 target orgs w/ phone numbers from docs/06. |

**Checkpoint A (hour 3): merge `be/registration` + `ui/signup`, deploy, one stranger's number registers end-to-end on prod.**

### Phase B — hours 3–8
| Who | Task |
|---|---|
| Claude | **CST Session Engine** (§3.2) — themes, prompts, silent harvesting, theme in session/start response. PR `be/cst`. Then **Clerk session verification** (§3.6 — JWKS verification, zero npm deps) + **Reminders API** (§3.3). PR `be/clerk`, `be/reminders`. |
| Tejas | **Clerk application setup** (enable Google + Email, add the prod domain to allowed origins, hand over the publishable key). **Pricing section** (3 tiers, copy in §7) with Dodo link slot; **TryPage theme chip** reading `theme` from session/start; dashboard **Engagement card** (§3.2 GET). |
| Teammate-2 | Dodo product setup (₹1,499/mo payment link) once verified; UptimeRobot on prod URL; test signup + sign-in/sign-out + **mic-in-installed-PWA** on 3 real phones (Android Chrome, iPhone Safari, low-end Android). |

**PWA (Tejas, Phase B/C seam, ~45 min):** manifest.json + minimal service worker + install prompt → "Add to Home Screen" app experience on Android & iOS. No store review needed. Optional Phase E stretch: Bubblewrap/PWABuilder TWA APK for sideloading on a centre's tablet (plain WebView wrappers are banned — OAuth sign-in and mic both misbehave in them). Play Store listing = roadmap, not tonight.

**Checkpoint B (hour 8): deploy. A themed session runs on prod; pricing page live with working checkout.**

### Phase C — hours 8–12
| Who | Task |
|---|---|
| Claude | **Session Scribe API** (§3.4). PR `be/scribe`. Then **/api/stats** (§3.5) + stability pass (error envelopes, session GC). PR `be/stats-hardening`. |
| Tejas | **Scribe UI**: record screen (big start/stop, elapsed timer, chunk upload via existing WAV encoder — copy from TryPage), report view (print-friendly — doctors get paper). **Stats page** `#/stats` for judges. UI polish pass with your own eye. |
| Teammate-2 | Full regression on prod using the tester script; consent line added to flyer ("conversations are recorded to build your parent's memory book"); print 3 copies of the pilot LOI (§8). |

**Checkpoint C (hour 12): feature-complete deploy. `node scripts/attack.mjs API=<prod>` green. Code freeze except bugfixes.**

### Phase D — hours 12–18 (users)
All three: outreach per docs/06 plan. Tejas+1 visit Nightingales (080-4242 6565) / local day-care with printed LOI; teammate-2 works WhatsApp/FB groups + onboards every signup personally (call them, walk them through first session). Claude: live bugfixes only + `/api/stats` watching; every new registration gets a welcome check (did they complete session 1? if not, teammate-2 calls).

### Phase E — hours 18–22 (submission)
Demo video (script exists), stats screenshots, LOI photo, submission writeup. **No deploys after hour 20.**

---

## 3. API CONTRACT (frozen)

Base: same-origin `/api/*` in prod; `http://localhost:3000` in dev. All errors: `{ "error": "<machine_key>", "message": "<human text>" }` with 4xx/5xx.

### 3.1 Registration
**POST `/api/register`**
```json
// request
{ "phone": "9876543210", "elder_name": "Kamala", "language": "kn-IN",
  "family_name": "Priya", "source": "web" }
// 200
{ "ok": true, "phone": "9876543210", "already_existed": false }
// 400 {"error":"bad_phone"} · 409 {"error":"already_registered"} (treat as success in UI, just log in)
```
Rules: phone = exactly 10 digits. `elder_name`/`language` optional (voice onboarding still works). Creates registration row; does NOT create the person (first conversation does, keeping voice-first onboarding).

**GET `/api/verify-phone?n=9876543210`** (exists) → `{ "ok": true }` — now checks registrations too.

**GET `/api/registrations?admin=1231231239`** → admin-only list for traction tracking:
```json
{ "count": 27, "rows": [{ "phone": "98…10", "elder_name": "Kamala", "language": "kn-IN",
  "source": "center", "plan": "founding", "created_at": "…", "sessions": 3, "memories": 14 }] }
```

### 3.2 CST Session Engine
**POST `/api/session/start`** — request unchanged `{ "phone": "…" }`. Response gains:
```json
{ "sessionId": "…", "text": "…", "audio": "<b64>", "person": "Kamala", "photo": null,
  "theme": { "key": "kahavat", "title": "Kahavatein aur kisse",
             "title_en": "Proverbs & the stories behind them" } }
```
Theme keys (fixed set): `kahavat` (proverb completion) · `shabd_bazaar` (category naming — the fluency biomarker) · `swad` (food & festivals) · `duniya` (opinions: cricket/weather/festivals) · `sangeet` (song talk / antakshari-style) · `yaadein` (plain reminiscence — default when a photo is queued or an open loop exists; photo/loop always outranks theme).
Selection: server-side — least-recently-used theme, personalized by one 30b call against her joyful memories. UI treats `theme` as display-only.

**GET `/api/people/:id/engagement`**
```json
{ "rounds": [ { "theme": "shabd_bazaar", "detail": "sabziyan", "items": 9,
                "enjoyed": 1, "created_at": "…" } ],
  "fluency_trend": [ { "at": "2026-07-27", "items": 9 } ] }
```

### 3.3 Reminders
**GET `/api/people/:id/reminders`** → `{ "reminders": [ { "id": 3, "text": "subah ki dawai nashte ke baad", "time_of_day": "morning", "active": 1, "ack_count": 4, "last_mentioned": "…" } ] }`
**POST `/api/people/:id/reminders`** `{ "text": "…", "time_of_day": "morning" }` → `{ "ok": true, "id": 3 }`
**POST `/api/reminders/:id`** `{ "active": 0 }` → `{ "ok": true }` (deactivate; no hard delete)
Behavior: at most ONE reminder woven per session (never turns the companion into an alarm clock); acknowledgment detected from her reply bumps `ack_count`.

### 3.4 Session Scribe
**POST `/api/scribe/start`** `{ "phone": "…", "person_id": 4, "facilitator": "Meena (activity coordinator)" }` → `{ "scribeId": "<uuid>" }`
**POST `/api/scribe/:id/chunk`** — body: raw WAV (same 16kHz PCM16 encoding as `/api/turn`), ≤25s per chunk, header `x-seq: <n>` → `{ "ok": true, "transcribed_seconds": 175 }`. UI sends chunks continuously while recording (reuse TryPage's encoder + MAX_REC_MS flush).
**POST `/api/scribe/:id/finish`** → 
```json
{ "report": {
    "summary": "…", "mood": "engaged and cheerful, tired near the end",
    "topics": ["1962 wedding in Mysore", "brother Shankar"],
    "recall_moments": [ { "type": "fluent", "quote": "…" },
                        { "type": "needed_help", "quote": "…" } ],
    "red_flags": ["asked the same question about lunch three times"],
    "for_doctor": "3–4 sentence clinical-adjacent paragraph",
    "duration_min": 32, "language": "kn-IN" },
  "memories_added": 5 }
```
Facts extracted from the session flow into the same memory store (provenance `SESSION_OBSERVED`). **GET `/api/people/:id/scribe-reports`** → list of past reports.

### 3.5 Stats
**GET `/api/stats`** (public, cached 60s)
```json
{ "families": 27, "elders": 24, "sessions": 61, "minutes_talked": 214,
  "memories": 312, "khel_rounds": 38, "scribe_sessions": 2, "languages": ["hi-IN","kn-IN","mr-IN"] }
```

### 3.6 Family sign-in (Clerk — replaces the Firebase OTP plan)
The **family** signs in; the **elder never does**. Clerk's React SDK holds the session and hands the browser a session JWT; `authFetch` attaches it as `Authorization: Bearer <jwt>` on every dashboard call. The server verifies it against Clerk's public JWKS (`app/clerk.js`, zero npm deps) and checks household ownership.
**GET `/api/auth-config`** → `{ "auth": "clerk" | "none", "sign_in_required": true }`
**POST `/api/register`** — when Clerk is on, requires a valid session; the account becomes the household's `owner_id`. `401 sign_in_required` · `403 already_claimed` if another account owns that number.
**Gated when Clerk is on:** everything under `/api/people`, `/api/memories`, `/api/reminders`, `/api/scribe`, `/api/digest` → `401 sign_in_required` or `403 not_your_household`.
**Never gated:** `/api/session/start`, `/api/turn`, `/api/turn-text`, `/api/stats`, `/api/verify-phone` — an elder with dementia cannot log in, and must never be asked to. Verified by test.
Env: `CLERK_PUBLISHABLE_KEY` (server) + `VITE_CLERK_PUBLISHABLE_KEY` (build). Unset ⇒ behaves exactly as before.

### 3.7 Existing (unchanged — UI already uses)
`POST /api/turn` (wav, headers `x-session-id`, `x-delay-ms`) · `POST /api/turn-text` · `GET /api/people?phone=` · `GET /api/people/:id/memories|briefing|memoir|photos|signals` · `POST /api/people/:id/photos` · `POST /api/memories/:id/policy|resolve` · `GET /api/digest?phone=` · `POST /api/debug/reset` · `POST /api/narrate`.

---

## 4. Prompt/quality rules that carry over into CST (Claude implements, everyone can flag violations)
- Errorless & opinion-first: no right/wrong feedback ever spoken; "let's think together", celebrate anything.
- Fluency counting is SILENT — she must never feel counted.
- One theme per session, abandoned instantly if she takes a tangent (rule 8 outranks the theme).
- Orientation as statements in the opener, never questions.
- All bans stay (yaad hai? / quiz forms) — attack suite must stay green; a CST test gets added to it.

## 5. Merge order (avoids conflicts)
`be/registration` → `ui/signup` → deploy → `be/cst` → `ui/pricing+theme` → deploy → `be/reminders` → `be/scribe` → `ui/scribe+stats` → `be/stats-hardening` → final deploy.

## 6. WhatsApp outreach message (teammate-2, tonight)

**Check `/api/waitlist` before you send this.** As of 28 Jul, `founding_left` is
**0** — all ten free-forever seats went in the first day. So the copy below no
longer offers one, because the first thing anyone does is open the link and see
`0 left` on that card. What is still true: **38 of 50 seats remain, free for
three months, then ₹1,499/mo, and we ask before charging anyone.**

That reads better than the original offer anyway — "the ten free-forever seats
went in a day" is scarcity you can prove. Keep the *count* out of the message
body though: the page has a live counter, and a hardcoded "38 left" is stale
within the hour.

    curl -s https://sarvam-buildathon-production.up.railway.app/api/waitlist

Link: `https://sarvam-buildathon-production.up.railway.app/#/waitlist`

**a. One-to-one (the one that actually converts — send it person by person)**

> Namaste 🙏 We're a small Bangalore team, and we've built **Yaadein** — someone
> for your parent to talk to who remembers yesterday.
>
> It calls them by name and chats for ten minutes a day about their own life, in
> their own language (Hindi, Kannada, Tamil, Telugu, Marathi, Bengali and 5 more).
> It never tests them and never corrects them. A few days later it says "you
> mentioned Pune — what do you like about Pune?" and the conversation carries on
> where it left off. Everything they say becomes a memory book for the family,
> and you get a picture of how they're actually doing.
>
> We opened 50 seats this week. The ten free-forever ones went on the first day,
> but the rest are free for three months, and we ask you before we ever charge
> you. No card to start.
>
> Your parent doesn't install anything or sign in to anything. You send them one
> link and they tap a circle and talk. Setup takes two minutes:
> https://sarvam-buildathon-production.up.railway.app/#/waitlist
>
> I'll set it up with you myself on a call if that's easier — just reply here.

**b. Community groups (Caregiver Saathi, "Dementia Care in India" FB groups, DIA
support groups)**

A wall of text in a support group reads as an ad and gets removed. Lead with the
problem the group already talks about, keep it to four lines, and say who you are.

> Hi all — I'm Tejas, from a small team in Bangalore. My own grandmother stopped
> recognising the house she'd lived in for forty years, and the hardest part was
> that nobody had ten minutes a day to just *talk* to her about her own life.
>
> So we built Yaadein: a voice companion that talks with elders in their own
> language, remembers what they said last time, and quietly tracks whether the
> recall came back. It's free for three months for the first 50 families, no card,
> and nothing for the elder to install.
>
> If it's useful to anyone here: https://sarvam-buildathon-production.up.railway.app/#/waitlist
> Happy to answer anything, and happy to be told it's not welcome here — mods,
> just say so and I'll delete it.

**Do not claim** in either message: WhatsApp digests (not built), cancel-by-
WhatsApp (not built), a phone call to the elder (the app notification is planned,
not shipped), or any diagnosis. The word "dementia" stays out of the B2C message
— 90% of Indian cases are undiagnosed and the family does not use that word yet.

## 7. Pricing copy (Tejas) — mirrors the live cards in `sections/Pricing.tsx`
- **Founding Family — Free** · a conversation every day in their own language, the family dashboard, their memory book. "For the first ten families to claim a seat. Free forever, with a founding badge — we want your feedback more than your money."
- **Family — ₹0 for 3 months, then ₹1,499/mo** · everything above + a weekly digest, priority voices, photo conversations, recall trends the doctor can read. Ribbon: *Not charging yet*. *"₹50 a day, once it starts. A trained memory-care attendant costs ₹40,000 a month — and doesn't speak their language."* Closing line: "No contract, and no card to start."
- **Care Centres — ₹600/seat/mo** · Session Scribe, member dashboards, white-label family reports, "your psychologist stops hand-writing progress notes". CTA is **Set up your centre** → Dodo checkout with the resident count in the URL, *not* a contact link (sending a care home to the families waitlist offers them the wrong product).

## 8. Pilot LOI (print 3)
One page: *"<Centre> agrees to a free 4-week pilot of Yaadein with up to 10 members (with family consent), including AI companion sessions and Session Scribe documentation. Success metrics: session completion, staff time saved on documentation, family satisfaction. <Centre> intends to evaluate a paid per-seat subscription following a successful pilot."* Signature lines + consent clause for audio recording.

## 9. Definition of done (per phase gate)
- A: stranger registers on prod and completes a voice session.
- B: themed session runs on prod; checkout link accepts a real ₹1 test payment.
- C: scribe records ≥5 min human conversation → report renders + prints; attack suite green on prod; stats page live.
- D: `/api/stats` ≥ 25 families, each with ≥1 session; ≥1 signed LOI photographed.
- E: video + screenshots + writeup submitted.
