// Pure text guards that shape Yaadein's voice.
//
// These are the rules no prompt reliably enforces, so they run in code after
// the model has spoken: don't repeat yourself, don't leave a recall phrase
// dangling, don't open every single turn with "Achha…".
//
// They live in their own module for two reasons. server.js starts listening the
// moment it is imported, so a test could not require it — scripts/voice-guards
// used to lift this source out with string slicing and eval it. And every
// function here is pure: same input, same output, no db, no network, no config.

// Repetition guard. With several instruction layers stacked (theme + reminder
// + open loop) the model can latch onto one formula and re-ask the same
// question turn after turn — the single worst thing to do to someone with
// memory loss, and something no prompt rule reliably prevents. So: measure it,
// and if a reply echoes the last one, regenerate with the echo forbidden.
function similarity(a, b) {
  const w = (s) => new Set(String(s).toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter((x) => x.length > 3));
  const A = w(a), B = w(b);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const x of A) if (B.has(x)) hit++;
  return hit / Math.min(A.size, B.size);
}

/* Last-resort turn. Not a canned line: it reflects back the longest thing they
   just said, which is the part they cared enough to elaborate on, and asks how
   it felt — a question with no wrong answer and nothing to recall. */
function openQuestionAbout(theirWords, turnIndex = 0) {
  const bit = String(theirWords)
    .split(/[.?!।,]/)
    .map((s) => s.trim())
    /* Two words is not enough on its own: "Theek hai" and "Haan haan" both
       clear that bar, and reflecting one back produced "Theek hai — us waqt
       aapko kaisa lagta tha?", which asks her how it felt to say "fine".
       Filler is not content, so it cannot be the thing we reflect. */
    .filter((s) => s.split(/\s+/).length >= 2 && !FILLER_ONLY.test(s))
    .sort((a, b) => b.length - a.length)[0];
  if (bit) return `${bit} — us waqt aapko kaisa lagta tha?`;
  /* With nothing to reflect this used to return one fixed sentence — which
     made the last-resort turn a repetition source in its own right: two
     consecutive turns both fell through to it and she was asked "us waqt
     aapko kaisa lagta tha?" twice in a row, by the very guard that exists to
     stop repetition. Rotating proposals cannot repeat consecutively, and a
     named proposal is what rule 2 asks for anyway. */
  return PROPOSALS[turnIndex % PROPOSALS.length];
}

/* The model quotes itself. Perhaps one turn in three comes back as
   `"Namaste, Kamala ji. Wahan subah kaisi lagti thi?` — a leading quotation
   mark, usually with no closing one, because it was told to output only
   spoken text and reached for a way to mark it as speech anyway.

   Two reasons this is not cosmetic. Bulbul reads the reply as text, so the
   mark either becomes a hesitation or nothing at all, and the quote is
   preserved in the memoir and every transcript the family reads. Worse, it
   was silently disabling the filler guard below: FILLER_LEAD is anchored at
   the start of the string, so `"Wah, kitna sundar` did not match while
   `Wah, kitna sundar` did. Fixing the quotes is what makes the existing
   filler stripping work at all.

   Only the outermost marks go. A quote INSIDE the reply is usually Yaadein
   repeating the elder's own words back to her, which is rule 3. */
function stripWrappingQuotes(reply) {
  let out = String(reply).trim();
  // Yaadein is speaking, never quoting, so a leading mark is always spurious
  out = out.replace(/^[\s"'“”‘’«»]+/, "");
  out = out.replace(/[\s"'“”‘’«»]+$/, "");
  return out.trim();
}

// same paragraph twice inside one reply — drop the duplicate
function dedupeParagraphs(reply) {
  const parts = String(reply).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const kept = [];
  for (const p of parts) if (!kept.some((k) => similarity(k, p) >= 0.85)) kept.push(p);
  return kept.join("\n\n");
}

// The model sometimes emits the recall phrase with nothing after it —
// "Aapne bataya tha ki..." — which sounds like Yaadein itself forgot
// mid-sentence: the exact impression we must never give. Drop the stub.
function dropDanglingRecall(reply) {
  const DANGLING = /(aapne\s+bataya\s+tha\s+ki|आपने\s+बताया\s+था\s+कि)\s*[.…]*\s*$/i;
  const parts = String(reply).split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const kept = parts.filter((p) => !DANGLING.test(p));
  const out = (kept.length ? kept : parts).join("\n\n");
  // also mid-paragraph: "...bataya tha ki... Aaj kya" → drop just the clause
  return out.replace(/(aapne\s+bataya\s+tha\s+ki|आपने\s+बताया\s+था\s+कि)\s*[.…]{2,}\s*/gi, "").trim();
}

/* Filler openers. On a page "Achha, …" reads as warmth; spoken aloud on every
   single turn it becomes a tic, and each one spends a second of Bulbul's voice
   before the question that actually matters. So they come off in code — the
   prompt asks for warmth and the model keeps reaching for the cheapest kind.

   The separator must include real punctuation, which is the whole trick: it
   splits the interjection "Bahut achha! Aapne…" from the sentence "Bahut achha
   lagta tha" — strip on a bare space and that second one becomes "Lagta tha". */
/* Every form below was produced by sarvam-30b in a recorded scenario run
   (scripts/sim.mjs) and survived into a reply the elder would have heard.
   Nothing here is guessed — when this list grows it should grow the same
   way, from a transcript. The second group is the one manual testing kept
   missing: bare agreement ("Haan haan,", "Theek hai.") reads as listening
   in text and as a verbal tic when it opens three turns in a row. */
const FILLER =
  "(?:arre+|are+|oh+|hmm+|hm+|umm+|wah+|waah+|achha|acha|accha|" +
  "bahut\\s+(?:achha|achhi|sundar|pyara|pyari|badhiya|khoob|khoobsurat|sahi)|" +
  "kya\\s+baat\\s+hai|kya\\s+khoob|sach\\s+mein|" +
  // bare agreement and praise, from the monosyllabic and codemix runs
  "haan(?:\\s+haan)*|haa+n|ji\\s+haan|haan\\s+ji|" +
  "theek\\s+hai|thik\\s+hai|sahi\\s+hai|bilkul|" +
  "kitna\\s+(?:sundar|pyara|pyari|achha|achhi|khoobsurat|badhiya)|" +
  "अच्छा|अरे|ओह|वाह|हम्म|क्या\\s+बात\\s+है|सच\\s+में|" +
  "हाँ(?:\\s+हाँ)*|हां|जी\\s+हाँ|हाँ\\s+जी|ठीक\\s+है|बिल्कुल|" +
  "कितना\\s+(?:सुंदर|प्यारा|प्यारी|अच्छा|अच्छी)|" +
  "बहुत\\s+(?:अच्छा|अच्छी|सुंदर|प्यारा|प्यारी|बढ़िया|खूब)|" +
  // the other scripts she speaks in — Tamil "அட", Telugu "అరె", Kannada "ಅರೆ",
  // Bengali "আরে", Malayalam "അയ്യോ". Caught the same way as the Hindi ones.
  "அட|அடடா|ஆஹா|అరె|ఆహా|ಅರೆ|ಆಹಾ|আরে|আহা|അയ്യോ|ആഹാ)";
// repeatable: "Arre wah! Kya baat hai!" is a pile of interjections, not one
const FILLER_ONLY = new RegExp(`^(?:(?:${FILLER})[\\s,!?.।…—-]*)+$`, "i");
const FILLER_LEAD = new RegExp(`^(?:(?:${FILLER})\\s*[,!?.।…—-]+\\s*)+`, "i");

function stripFillers(reply) {
  /* Quotes first, or the anchored patterns below cannot match — see
     stripWrappingQuotes for how that hid this whole guard. */
  const cleaned = stripWrappingQuotes(reply);
  const parts = cleaned.split(/(?<=[.?!।])\s+/).map((s) => s.trim()).filter(Boolean);

  /* A whole sentence that is nothing but praise carries none of the reply's
     meaning. This used to only shift() off the FRONT, which meant
     "Aam ka ped! Bahut achha. Uski khushboo kaisi thi?" kept its "Bahut
     achha." — the loop stopped at the first non-filler sentence and never
     looked further. Drop them wherever they sit; never leave her with
     nothing to say. */
  const kept = parts.filter((p) => !FILLER_ONLY.test(p));
  const body = (kept.length ? kept : parts.slice(0, 1)).join(" ");

  const lean = body.replace(FILLER_LEAD, "").trim();
  let out = lean.length >= 12 ? lean : body; // don't whittle a short reply to a stump
  out = out.trim();
  return out ? out[0].toUpperCase() + out.slice(1) : cleaned;
}

/* ── keeping the floor ─────────────────────────────────────────────
   A reply with no question in it is a dead end, and dead ends are how a
   conversation with someone who has memory loss simply stops: she has
   nothing to answer, so she says nothing, so the session ends. Recorded
   examples, all shipped to a real reply — "Aaj baat karte hain.",
   "Theek hai. Aaj baat karte hain.", "Aapka swagat hai." Three of six turns
   in one scenario run were dead ends.

   prompts.js rule 2 already says lead every turn with a concrete proposal;
   this is the same rule enforced after the fact, like every other guard in
   this file. */
function lastQuestion(reply) {
  /* Split on every sentence end, not only on "?". Splitting on the question
     mark alone returned the entire reply whenever there was exactly one
     question in it — which is the normal case — so the comparison below was
     really comparing whole replies again and the repeated-question bug
     survived its own guard. */
  const qs = String(reply)
    .split(/(?<=[.?!।])\s+/)
    .map((s) => s.trim())
    .filter((s) => /[?？]$/.test(s));
  return qs.length ? qs[qs.length - 1] : null;
}

const hasQuestion = (reply) => /[?？]/.test(String(reply));

/* Two named options, which rule 2 calls the best possible turn, for when she
   has given us nothing to reflect back ("Haan.", "Achha."). Reflecting is
   better when there is something to reflect, so openQuestionAbout wins
   whenever it can find a phrase. */
const PROPOSALS = [
  "Bachpan ke ghar ki baat karein, ya kisi tyohar ki?",
  "Khane-peene ki baat karein, ya gaane ki?",
  "School ke dinon ki baat karein, ya doston ki?",
];

const keepTheFloor = (theirWords, turnIndex = 0) => openQuestionAbout(theirWords, turnIndex);

/** Did this reply repeat the last one, or just re-ask the same question? */
function repeatsPrevious(reply, prevReply) {
  if (!reply || !prevReply) return false;
  if (similarity(reply, prevReply) >= 0.7) return true;
  /* The bug this second clause exists for: two replies whose openings differ
     but which end with the identical question. "Delhi! Wahan ki bheed...
     Aapka ghar Delhi mein tha?" then "Haan, station par... Aapka ghar Delhi
     mein tha?" — whole-reply similarity was 0.4 and the guard let it through,
     so she was asked the same question twice in consecutive turns. */
  const a = lastQuestion(reply), b = lastQuestion(prevReply);
  return !!(a && b && similarity(a, b) >= 0.8);
}

/* C6/C4 guard: recall-testing phrases must never reach her voice.
   Prompt rules alone leak variants ("yaad aa rahi hai?") — enforced in code.

   It lives here rather than in server.js because it is the same kind of thing
   as everything else in this file: a pure text rule about how Yaadein speaks.
   server.js enforces it at runtime and sim.js checks scripted replies against
   it; two copies of this regex is how one of them quietly stops matching. */
const BANNED = /(yaad\s+(hai|hain|karo|kar|aa\s*rah[ia]|aay[ia]|aat[ia]|aaye|dila)|याद\s+(है|हैं|करो|कर|आ\s*रह[ीा]|आय[ीा]|आत[ीा]|आए|दिला))/i;

module.exports = {
  similarity, openQuestionAbout, dedupeParagraphs, dropDanglingRecall, stripFillers,
  stripWrappingQuotes, lastQuestion, hasQuestion, keepTheFloor, repeatsPrevious,
  BANNED,
  // exported for the tests, which check the regexes directly
  FILLER, FILLER_ONLY, FILLER_LEAD,
};
