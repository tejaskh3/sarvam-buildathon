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

## D11 — Access by allowlisted phone number; identity = (number, name)
**Decision (Tejas, 26 Jul):** no auth. A 10-digit number on the server allowlist opens the chat and the Family Dashboard. Public test number **1234567890** (shown in the popup); private team numbers 1231231239 and 1231231238. Allowlist is overridable via `ALLOWED_PHONES` env var on Railway.
**My additions:** the number also **scopes memory** — a person is (number, name), so testers on different numbers can never see or pollute each other's people; `/api/people` and `/api/digest` require a listed number; unlisted/missing numbers get 403 (3 new attack-suite tests). The number is remembered per device in localStorage.
**Known limits:** anyone with the test number shares that household (expected); per-person memory/photo endpoints are still id-addressable — real ACLs come with real auth, post-hackathon.

## D12 — Recall difficulty = time-to-first-word, measured in the browser
**Decision (mentor feedback, 26 Jul):** every voice turn logs the question asked and the pause between Yaadein's audio ending and the elder's first voiced frame. **≥4s = hard question (amber alert), ≥7s = very hard (red)** — thresholds are a first guess, tune after real-elder testing. Barge-in counts as an instant answer (0ms).
**Why client-side:** the browser is the only place that knows when playback actually finished and when speech actually started; server timestamps would include network + TTS decode noise.
**Family surface:** new "Alerts & trends" dashboard tab — slow-question alert cards, "memories getting harder" list (prov_history trajectory sliding to bare confirmation), and an SVG trend graph (avg pause line vs. memories-captured bars, with the 4s hard-question line drawn in) for planning support.
