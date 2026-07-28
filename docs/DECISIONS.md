# Decision log — autonomous calls taken during the build

*(Per Tejas's instruction 26 Jul: take the best call, log it for later review. Flag anything you disagree with and I'll change it.)*

## D1 — No Sarvam Vision for family photos
**Decision:** photo conversations are driven entirely by **family-supplied context** (event, place, year, who's in frame, notes). No Vision call.
**Why:** verified in docs — Sarvam Vision is a *document OCR/digitization* model (PDF/PNG/JPG of documents, batch API), not a photo captioner. It cannot describe a wedding scene. Family context is also safer: the agent never guesses who's in a photo.
**Revisit when:** we add document uploads (wedding invitations, letters) — Vision is right for those.

## D2 — Deceased flag is a hard gate on photo upload
**Decision:** upload API **rejects** any photo where a person in frame lacks an explicit `deceased: yes/no`. Photos with unresolved flags never reach a session.
**Why:** spec F2 — the worst possible failure is the agent cheerfully asking about a dead relative. Made it structurally impossible rather than a guideline.

## D3 — Language memory via STT detection + translated opener
**Decision:** store the last Bulbul-supported language Saaras detects on the person (`people.lang`, en-IN excluded so a few English words don't flip the profile). Next session's **opener is generated in Hindi then run through Sarvam Translate** into their language; mid-conversation the model mirrors their language naturally.
**Why:** tested — sarvam-30b would *not* reliably open in Marathi from an empty history on instruction alone (two attempts failed); Translate made it deterministic (verified: proper Marathi opener).
**Known wart:** Latin-script names can get mangled by Translate (saw "LangTest"→"LongTest"). Real Indian names in context fare better; watch it in testing.

## D4 — Photos surface at session start only (v1)
**Decision:** one undiscussed photo becomes the session opener; not injected mid-conversation.
**Why:** mid-conversation injection needs topic-relevance logic and risks derailing her tangent (violates A6 — yield to her). Start-of-session is predictable, demoable, and matches "family adds a photo → next conversation opens with it."

## D5 — Family Dashboard is a React page; raw HTML pages kept as backup
**Decision:** built `#/family` in the landing app (briefing / memoir with EN translation + narration / all memories with resolve+avoid / photo upload). The old `/memory.html` and `/family.html` still work as judge/debug tools.
**Why:** feedback that bare HTML doesn't read as a product. Kept the HTML pages because they're useful on a projector and cost nothing.

## D6 — Memoir translation is on-demand per chapter (?lang=en-IN), not stored
**Decision:** translate at read time, no caching.
**Why:** memoir regenerates as memories grow; caching adds invalidation complexity for a demo-scale product. Costs one Translate call per paragraph per view.

## D7 — Coordinator digest is an API + dashboard strip, not a separate page
**Decision:** `/api/digest` returns per-person flags (unresolved count, avoided count, open loop, language); surfaced inside the Family Dashboard rather than a fourth page.
**Why:** with 2–3 demo people a dedicated coordinator page looks empty; the same data strengthens the family page. Revisit for the facility pitch with seeded personas.
**Status note:** API is live; the dashboard strip renders people with counts — a dedicated "needs attention" view is Phase 7 polish.

## D8 — Probing fix is a prompt rule, not an architecture change
**Decision:** added rule 9 ("GEHRAI se KHODO") — every reply must grab one concrete detail from her last utterance and dig (feeling/smell/sound/who was there), with a good/bad example. Word cap raised 30→35 to make room.
**Why:** verified before/after — replies went from generic warmth to "Patang katne par kya awaaz aati thi?". Cheapest fix that addressed Amey's feedback; revisit only if testing still shows shallow turns.

## D9 — No Docker/Postgres
**Decision:** stayed on SQLite (node:sqlite, zero deps) even though Docker was offered.
**Why:** nothing needed relational scale; SQLite deploys as one file with the server on Railway. Postgres becomes right when auth/multi-tenant arrives.

## D10 — English number words added to variance detection; non-numeric contradictions still open
**Decision:** contradiction detection covers digits + Hindi + English number words. "Pune vs Nagpur"-type (no numbers) contradictions still coexist rather than flag.
**Why:** the clean fix is an LLM contradiction check on dup-suspects (~30 min, one more Sarvam call per suspect). Deferred to hardening — flagged to testers as known limitation.

## D18 — Clerk replaces Firebase; the family signs in, the elder never does
**Decision (Tejas, 28 Jul):** drop Firebase Phone Auth, use Clerk. Firebase is fully removed (`app/firebase.js`, `src/lib/otp.ts`, the npm package, all env vars and docs).
**Why Clerk is better here:** real sessions with a real sign-out (phone OTP gave us neither), Google/email sign-in that works instantly in India, and no SMS-delivery risk at a hackathon venue — a failed OTP during the user push would have been unrecoverable.
**The architectural call I made:** identity is **split**. The **family** (adult child) signs in with Clerk and owns the dashboard; the **elder** is a phone number on a device and never authenticates. Asking someone with memory loss to log in would contradict the product. So `/api/session/start`, `/api/turn`, `/api/stats` are never gated — verified by test — while everything under `/api/people|memories|reminders|scribe|digest` requires a session *and* household ownership when Clerk is on.
**Ownership model:** the first signed-in account to register a number claims it (`registrations.owner_id`); another account then gets `403 already_claimed`. Numbers registered before Clerk was enabled stay unclaimed and readable, so nobody is locked out of data they already had.
**Implementation:** `app/clerk.js` verifies session JWTs against Clerk's public JWKS with `node:crypto` — the backend stays at **zero npm dependencies** (no `@clerk/backend`). The issuer is derived from the publishable key, so one env var configures both sides. Everything is feature-flagged: with no key set the app behaves exactly as before, which is also how the attack suite still runs (it exits with a clear warning if pointed at a sign-in-required deployment).

## D14 — CST session themes, chosen server-side, harvested silently
**Decision (Epoch sprint, 27 Jul):** every returning session runs one of five themed activities from the validated CST protocol — `kahavat` (proverbs), `shabd_bazaar` (category naming), `swad` (food/festivals), `duniya` (opinions), `sangeet` (songs). Least-recently-used selection, server-side; the UI only displays the name. Priority: a family photo outranks the game entirely; an unfinished story is reopened first and the game follows.
**Why these five:** they are the talk-based sessions from the UCL CST protocol (Cochrane CD005562) as adapted for India by SCARF/Chennai (Tamil-validated) — proverbs are literally the iCST "Old Wives' Tales" activity. Sources in docs/06.
**The measurement:** category-naming counts are stored in `engagement.items` and never spoken aloud. Semantic verbal fluency is a classic dementia screen, so each round doubles as a passive administration of a validated instrument. Nobody is ever told a number.
**Honest limit:** the definitive home-iCST RCT (n=356) was null on cognition because family delivery collapsed. We claim only that an always-available agent removes that adherence failure — never proven cognition gains.

## D15 — Conversation-quality guards live in code, not prompts (three new ones)
**Decision:** three failure modes found in testing are now enforced in code with regression tests, because prompt rules leaked every time:
1. **Repetition** — with theme + reminder + open-loop instructions stacked, the model re-asked the same question four turns running (the cruelest possible bug here). A similarity check regenerates any reply that echoes the previous one; a paragraph deduplicator catches in-reply repeats.
2. **Dangling recall** — "Aapne bataya tha ki…" with nothing after it makes *Yaadein* sound like it forgot. Stripped.
3. **Cue leaking the answer** — the hint kept restating the fact she was reaching for ("your son Akash is a doctor — is he in the healing profession?"). Now any cue that repeats ≥2 distinctive words from a stored memory is regenerated, then sentence-filtered as a last resort. Single-word scaffolding ("he's in Mumbai…") is allowed — a human would do that.
**Also:** theme instructions were rewritten without quotable example dialogue after the model spoke the examples verbatim, and the full instruction now goes only into the opener (a one-line nudge afterwards) because repeating it made the model restart the game every turn.

## D16 — Reminders are woven, never alarms; orientation is stated, never asked
**Decision:** at most ONE family reminder per session, delivered mid-conversation in the agent's own words, dropped once acknowledged. Adherence is reported as "answered 2/5" — explicitly *not* "medicine taken", because we cannot know that.
**Orientation:** day/part-of-day/season (IST) are handed to the model as a statement it may mention warmly; asking "what day is it?" is banned. CST's own guidance is that orientation must be implicit — explicit reality-orientation drilling increases agitation beyond early stages.

## D17 — Session Scribe uses sarvam-105b and its own provenance grade
**Decision:** the human-session report runs on `sarvam-105b` (not 30b) with `response_format: json_object`, and facts it extracts enter the memory store as `SESSION_OBSERVED` — distinct from anything the elder told the agent directly.
**Why:** the report is a clinical-adjacent document read by a doctor; quality outranks latency (nobody is waiting on a voice turn). The separate grade keeps the family able to tell "she told Yaadein this" from "this was observed in a session with staff". The prompt forbids diagnosis and treatment advice, and requires quotes to be verbatim from the transcript.

## D13 — Identity is the number alone (supersedes the identity half of D11)
**Decision (Tejas, 26 Jul):** one allowlisted number = one elder = one memory store, and the same number opens the Family Dashboard. The name is only what Yaadein calls them, learned in the first session. This also made the device-side name hint obsolete — a returning number resumes its thread with no localStorage involved.
**Trade-offs accepted:** two people sharing one number share one persona (multi-user arrives with real auth); everyone on the public test number shares one test persona — expected, and `POST /api/debug/reset {phone}` (allowlisted numbers only) wipes a number for demo restarts. The attack suite now runs A and B on two different numbers and resets both first.

## D11 — Access by allowlisted phone number; identity = (number, name)
**Decision (Tejas, 26 Jul):** no auth. A 10-digit number on the server allowlist opens the chat and the Family Dashboard. Public test number **1234567890** (shown in the popup); private team numbers 1231231239 and 1231231238. Allowlist is overridable via `ALLOWED_PHONES` env var on Railway.
**My additions:** the number also **scopes memory** — a person is (number, name), so testers on different numbers can never see or pollute each other's people; `/api/people` and `/api/digest` require a listed number; unlisted/missing numbers get 403 (3 new attack-suite tests). The number is remembered per device in localStorage.
**Known limits:** anyone with the test number shares that household (expected); per-person memory/photo endpoints are still id-addressable — real ACLs come with real auth, post-hackathon.

## D12 — Recall difficulty = time-to-first-word, measured in the browser
**Decision (mentor feedback, 26 Jul):** every voice turn logs the question asked and the pause between Yaadein's audio ending and the elder's first voiced frame. **≥4s = hard question (amber alert), ≥7s = very hard (red)** — thresholds are a first guess, tune after real-elder testing. Barge-in counts as an instant answer (0ms).
**Why client-side:** the browser is the only place that knows when playback actually finished and when speech actually started; server timestamps would include network + TTS decode noise.
**Family surface:** new "Alerts & trends" dashboard tab — slow-question alert cards, "memories getting harder" list (prov_history trajectory sliding to bare confirmation), and an SVG trend graph (avg pause line vs. memories-captured bars, with the 4s hard-question line drawn in) for planning support.

## D19 — The ack bank is gone; the thinking pause is silent (reverses A3's mechanism)
**Decision (Tejas, 28 Jul, from user feedback):** the pre-rendered acknowledgement clips — `अच्छा...`, `हम्म...`, `हाँ हाँ...`, `अच्छा, समझी...`, `हाँ, बताइए...` — no longer play when the elder stops speaking. `ensureAcks()`, the boot-time render, `GET /api/acks` and the browser's preload/`playAck()` are all removed.
**Why:** story A3 ("never leave me in silence") was solved by firing one of five sounds within 300ms of the recording ending. Testers heard the tic, not the warmth: the same handful of noises answered *every* turn, and they fired **before a word had been transcribed** — Yaadein appearing to agree with something she had not yet heard. That is the same unearned confidence the rest of `voice.js` exists to prevent, and it made a long thinking pause worse rather than better, because the "achha…" set an expectation of a reply that then did not come.
**What covers the gap now:** "One moment" under the orb, carrying a four-bar wave (`ThinkingLabel` in `components/Orb.tsx`, riding the site's existing `wave-bar` keyframe). A3's *goal* — never leave her wondering whether anything is happening — stands; only its mechanism moved from the speaker to the screen. Text alone was not enough: a static line under a still orb is indistinguishable from a frozen page, and the wave is what makes the wait read as work. Deliberately grey, not the purple/pink that mean a voice is active — nothing is being said, and borrowing those colours would imply otherwise.
**Also:** `aha`/`aaha`/`आहा` added to the `FILLER` list in `app/voice.js` — the tic was coming back through the model's own replies, and that spelling was the one gap in the list.
**Known limit:** on a slow Sarvam turn the elder hears nothing at all for a second or two, and the wave only helps someone who is looking at the tablet. If real-elder testing shows that a listener who has looked away thinks it broke, the next step is a non-verbal *sound* — a soft tone, not words, and never words chosen before we have listened.
**Leftover:** `app/data/acks/*.wav` are now unreferenced. Harmless, and deleting them from a live volume is not worth a deploy; they go on the next volume wipe.
