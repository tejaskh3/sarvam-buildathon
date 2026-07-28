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
function openQuestionAbout(theirWords) {
  const bit = String(theirWords)
    .split(/[.?!।,]/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 2)
    .sort((a, b) => b.length - a.length)[0];
  return bit
    ? `${bit} — us waqt aapko kaisa lagta tha?`
    : "Us waqt aapko kaisa lagta tha?";
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
const FILLER =
  "(?:arre+|are+|oh+|hmm+|hm+|umm+|wah+|waah+|achha|acha|accha|" +
  "bahut\\s+(?:achha|achhi|sundar|pyara|pyari|badhiya|khoob)|kya\\s+baat\\s+hai|sach\\s+mein|" +
  "अच्छा|अरे|ओह|वाह|हम्म|क्या\\s+बात\\s+है|सच\\s+में|" +
  "बहुत\\s+(?:अच्छा|अच्छी|सुंदर|प्यारा|प्यारी|बढ़िया)|" +
  // the other scripts she speaks in — Tamil "அட", Telugu "అరె", Kannada "ಅರೆ",
  // Bengali "আরে", Malayalam "അയ്യോ". Caught the same way as the Hindi ones.
  "அட|அடடா|ஆஹா|అరె|ఆహా|ಅರೆ|ಆಹಾ|আরে|আহা|അയ്യോ|ആഹാ)";
// repeatable: "Arre wah! Kya baat hai!" is a pile of interjections, not one
const FILLER_ONLY = new RegExp(`^(?:(?:${FILLER})[\\s,!?.।…—-]*)+$`, "i");
const FILLER_LEAD = new RegExp(`^(?:(?:${FILLER})\\s*[,!?.।…—-]+\\s*)+`, "i");

function stripFillers(reply) {
  const parts = String(reply).split(/(?<=[.?!।])\s+/).map((s) => s.trim()).filter(Boolean);
  // a whole sentence that is nothing but praise ("Bahut achha!") carries none
  // of the reply's meaning — but never leave her with nothing to say
  while (parts.length > 1 && FILLER_ONLY.test(parts[0])) parts.shift();
  let out = parts.join(" ");
  const lean = out.replace(FILLER_LEAD, "").trim();
  if (lean.length >= 12) out = lean; // don't whittle a short reply down to a stump
  out = out.trim();
  return out ? out[0].toUpperCase() + out.slice(1) : String(reply).trim();
}

module.exports = {
  similarity, openQuestionAbout, dedupeParagraphs, dropDanglingRecall, stripFillers,
  // exported for the tests, which check the regexes directly
  FILLER, FILLER_ONLY, FILLER_LEAD,
};
