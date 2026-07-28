/* ------------------------------------------------------------------
   The scenario simulator — scripted conversations, linted automatically.

   Why this exists. Every bug we have found in the conversation itself was
   found by one of us talking to a phone for ten minutes and noticing
   something felt wrong. That does not scale, it costs a Bulbul render per
   turn, and it cannot be repeated identically after a change — which means
   we have never once been able to say "this reply got better" with evidence.

   So: a named scenario seeds a household into a known state, plays a fixed
   script of elder utterances through the REAL HTTP routes, and runs every
   reply past a set of checks derived from the product's own rules. What
   comes back is a transcript with flags on it.

   Two design rules, both load-bearing:

   · It drives /api/session/start and /api/turn-text over real HTTP rather
     than calling handleTurn() directly. A simulator that calls internals
     is a second implementation of the turn pipeline, and the day they
     diverge is the day the simulator starts certifying behaviour the
     browser never sees.

   · Every check here restates a rule that already exists somewhere else in
     the product — prompts.js rule 4 (never test recall), rule 10 (under 35
     words), the BANNED regex, the "spoken, not translated" claim on the
     landing page. Nothing is invented. If a check and the product disagree,
     one of them is a bug, and that is the point.

   This module is pure: scenarios in, flags out. No db, no network, no
   config. server.js owns the orchestration; scripts/sim-tests.mjs tests
   the checks themselves.
   ------------------------------------------------------------------ */

const { similarity, BANNED } = require("./voice");

/* Sim households live on numbers that cannot exist. Indian mobiles start
   6-9, so a 5 can never collide with a real family — and the runner refuses
   any number outside this range unless it is one of the team's own. That is
   the whole safety story: a scenario reset can never wipe a real household. */
const SIM_PREFIX = "5";
const isSimPhone = (p) => /^5\d{9}$/.test(String(p || ""));

/* ── the scripts ───────────────────────────────────────────────────
   Each scenario names the bug it is hunting. A scenario with no `hunts`
   line is decoration and should be deleted. */
const SCENARIOS = {
  "first-meeting": {
    phone: "5000000001",
    title: "A number nobody has registered",
    hunts:
      "Does she introduce herself and ask the name — once — and then use it? " +
      "Does she claim a shared history she cannot have (prompts.js rule 5)?",
    /* No elder_name, on purpose. The runner still creates the household row —
       phoneOk() is what lets a device talk at all — but with no name on it,
       which is exactly the state where server.js falls back to asking by
       voice. That fallback is the path nobody ever tests. */
    register: null,
    expect: { lang: "hi-IN", knowsName: false },
    turns: [
      "Namaste.",
      "Mera naam Kamala hai.",
      "Main Thanjavur mein badi hui thi.",
      "Hamare ghar ke saamne ek bada aam ka ped tha.",
    ],
  },

  "registered-first-call": {
    phone: "5000000002",
    title: "Registered at signup, has never spoken",
    hunts:
      "The commonest real state: we know the name and language from the form " +
      "and there are no memories yet. personContext() returns null here, so " +
      "this is where a missing per-turn language directive shows up.",
    register: { elder_name: "Kamala", language: "hi-IN" },
    expect: { lang: "hi-IN", knowsName: true, noPriorTalk: true },
    turns: [
      "Haan ji, namaste.",
      "Main pehle Thanjavur mein rehti thi.",
      "Wahan mandir ke paas hamara ghar tha.",
    ],
  },

  "returning-elder": {
    phone: "5000000003",
    title: "Comes back with memories and an unfinished story",
    hunts:
      "The recognition moment (contract RESUMED), and whether the unfinished " +
      "story is reopened by name instead of restarted.",
    register: { elder_name: "Kamala", language: "hi-IN" },
    seed: {
      person: "Kamala",
      lang: "hi-IN",
      memories: [
        { statement: "Main Thanjavur mein badi hui", canonical: "Grew up in Thanjavur", category: "place" },
        { statement: "Mere ghar ke saamne aam ka ped tha", canonical: "A mango tree in front of the house", category: "place" },
        { statement: "Maa sambar bahut achha banati thi", canonical: "Mother made very good sambar", category: "food" },
        { statement: "Mera beta Akash doctor hai", canonical: "Son Akash is a doctor", category: "person" },
        { statement: "Diwali par sab ghar aate the", canonical: "Everyone came home for Diwali", category: "festival" },
      ],
      open_loop: "Thanjavur ke mandir ke utsav ki kahani — aadhi reh gayi thi",
    },
    expect: { lang: "hi-IN", knowsName: true, resumed: true },
    turns: [
      "Haan, namaste.",
      "Us utsav mein hum sab subah jaate the.",
      "Bahut bheed hoti thi, aur prasad milta tha.",
    ],
  },

  "stalled-recall": {
    phone: "5000000004",
    title: "She reaches for something and it will not come",
    hunts:
      "The single most delicate turn in the product. The hint must be a " +
      "yes/no nudge that does NOT contain the answer, and must never say " +
      "'aapne bataya tha'. Routes to sarvam-105b.",
    register: { elder_name: "Kamala", language: "hi-IN" },
    seed: {
      person: "Kamala",
      lang: "hi-IN",
      memories: [
        { statement: "Mera beta Akash Mumbai mein doctor hai", canonical: "Son Akash is a doctor in Mumbai", category: "person" },
        { statement: "Main Thanjavur mein badi hui", canonical: "Grew up in Thanjavur", category: "place" },
      ],
    },
    expect: { lang: "hi-IN", knowsName: true, noLeakAfterStall: true },
    turns: [
      "Haan ji.",
      "Mera beta hai na... mujhe yaad nahi aa raha woh kya kaam karta hai.",
      "Nahin, kuch yaad nahi aa raha.",
    ],
  },

  "tamil-elder": {
    phone: "5000000005",
    title: "A Tamil speaker, registered in Tamil, first conversation",
    hunts:
      "The landing page's headline claim: eleven languages, spoken not " +
      "translated. With no stored memories there is no personContext(), so " +
      "this is the scenario that proves whether the language survives.",
    register: { elder_name: "Kamala", language: "ta-IN" },
    expect: { lang: "ta-IN", knowsName: true, noPriorTalk: true },
    turns: [
      "வணக்கம்.",
      "நான் தஞ்சாவூரில் வளர்ந்தேன்.",
      "எங்கள் வீட்டில் ஒரு பெரிய மாமரம் இருந்தது.",
    ],
  },

  "marathi-returning": {
    phone: "5000000006",
    title: "A Marathi speaker who already has memories",
    hunts:
      "The control for tamil-elder. Here personContext() DOES exist, so the " +
      "language line is present. If this passes and tamil-elder fails, the " +
      "bug is the missing context, not the model.",
    register: { elder_name: "Sunanda", language: "mr-IN" },
    seed: {
      person: "Sunanda",
      lang: "mr-IN",
      memories: [
        { statement: "मी पुण्यात लहानाची मोठी झाले", canonical: "Grew up in Pune", category: "place" },
        { statement: "आई पुरणपोळी छान करायची", canonical: "Mother made good puranpoli", category: "food" },
      ],
    },
    expect: { lang: "mr-IN", knowsName: true, resumed: true },
    turns: [
      "नमस्कार.",
      "आमच्या घरासमोर एक मोठं आंब्याचं झाड होतं.",
      "उन्हाळ्यात आम्ही त्याखाली खेळायचो.",
    ],
  },

  codemix: {
    phone: "5000000007",
    title: "Two languages in one sentence",
    hunts:
      "Why saaras runs in codemix mode at all. 'Humne train pakdi thi' is " +
      "one thought; the reply must treat it as one.",
    register: { elder_name: "Kamala", language: "hi-IN" },
    expect: { lang: "hi-IN", knowsName: true },
    turns: [
      "Haan namaste.",
      "Humne train pakdi thi aur phir Delhi pahunche the.",
      "Station par bahut crowd tha, family saath thi.",
    ],
  },

  monosyllabic: {
    phone: "5000000008",
    title: "She answers in one word, five times",
    hunts:
      "The worst failure mode we have: with nothing to work from the model " +
      "latches onto one formula and re-asks the same question. Saying the " +
      "same thing twice to someone with memory loss is the whole thing we " +
      "must never do.",
    register: { elder_name: "Kamala", language: "hi-IN" },
    seed: {
      person: "Kamala",
      lang: "hi-IN",
      memories: [
        { statement: "Main Thanjavur mein badi hui", canonical: "Grew up in Thanjavur", category: "place" },
      ],
    },
    expect: { lang: "hi-IN", knowsName: true, noEcho: true },
    turns: ["Haan.", "Theek hai.", "Pata nahi.", "Haan haan.", "Achha.", "Hmm."],
  },

  "reminder-woven": {
    phone: "5000000009",
    title: "The family asked us to mention her medicine",
    hunts:
      "It must arrive once, mid-conversation, as care rather than an alarm — " +
      "and must not be repeated. Also whether it arrives at all on a first " +
      "call, where the mid-conversation nudge is gated behind sess.context.",
    register: { elder_name: "Kamala", language: "hi-IN" },
    seed: {
      person: "Kamala",
      lang: "hi-IN",
      memories: [
        { statement: "Main Thanjavur mein badi hui", canonical: "Grew up in Thanjavur", category: "place" },
      ],
      reminder: { text: "Subah ki dawai le lijiye", time_of_day: null },
    },
    expect: { lang: "hi-IN", knowsName: true, reminderOnce: "dawai" },
    turns: [
      "Haan ji namaste.",
      "Aaj mausam achha hai.",
      "Haan, ghar par hi thi din bhar.",
      "Bagiche mein baithi thi thodi der.",
    ],
  },
};

/* ── script detection ──────────────────────────────────────────────
   "Spoken, not translated" is a claim about the writing system, so it can
   be measured. Each language gets the block its speakers actually read. */
const SCRIPTS = {
  "hi-IN": ["Devanagari", "\\u0900-\\u097F"],
  "mr-IN": ["Devanagari", "\\u0900-\\u097F"],
  "bn-IN": ["Bengali", "\\u0980-\\u09FF"],
  "pa-IN": ["Gurmukhi", "\\u0A00-\\u0A7F"],
  "gu-IN": ["Gujarati", "\\u0A80-\\u0AFF"],
  "od-IN": ["Odia", "\\u0B00-\\u0B7F"],
  "ta-IN": ["Tamil", "\\u0B80-\\u0BFF"],
  "te-IN": ["Telugu", "\\u0C00-\\u0C7F"],
  "kn-IN": ["Kannada", "\\u0C80-\\u0CFF"],
  "ml-IN": ["Malayalam", "\\u0D00-\\u0D7F"],
  "en-IN": ["Latin", "A-Za-z"],
};

/**
 * What fraction of the written characters in `text` belong to `lang`'s script.
 *
 * Counts marks as well as letters, which is the whole correctness of this
 * function for Indian scripts: Tamil வ + ண + க + ் is four characters but only
 * three are \p{L}, so measuring the block against a letters-only denominator
 * returned 1.58 — a "158% Tamil" reply, which is how this bug announced itself.
 */
function scriptFit(text, lang) {
  const entry = SCRIPTS[lang];
  if (!entry) return null;
  const written = String(text).match(/[\p{L}\p{M}]/gu) || [];
  if (!written.length) return null;
  const own = new RegExp(`[${entry[1]}]`, "u");
  const hits = written.filter((c) => own.test(c)).length;
  return { script: entry[0], fit: hits / written.length, chars: written.length };
}

/* ── the checks ────────────────────────────────────────────────────
   Each returns a flag object or null. `level` is how we triage a run:
   fail = the elder was harmed by this reply, warn = a rule slipped. */
const WORD_LIMIT = 35; // prompts.js rule 10

/**
 * Lint one agent reply against the product's own rules.
 *
 * Deliberately conservative about `wrong_script`: for hi-IN a romanised
 * reply is fine, because the entire system prompt is written in romanised
 * Hinglish and Bulbul renders it correctly. For the other ten it is not —
 * a Tamil grandmother cannot read her own language in Latin letters, and
 * that is exactly the claim the Languages section makes.
 */
function lintReply({
  reply,
  prevReply = null,
  elderSaid = null,
  expectLang = null,
  knownFacts = [],
  afterStall = false,
  hasMemories = true,
  knowsName = false,
  /** 0 = the opener. Some rules only apply once the conversation is running. */
  turnIndex = 0,
}) {
  const flags = [];
  const add = (code, level, detail) => flags.push({ code, level, detail });
  const text = String(reply || "");

  if (!text.trim()) {
    add("empty_reply", "fail", "she said nothing at all");
    return flags;
  }

  /* Rule 4 + the BANNED regex: never test her recall. This is the one that
     hurts a real person, so it is a fail wherever it appears. */
  const banned = text.match(BANNED);
  if (banned) add("banned_recall", "fail", `recall-test phrase reached her: "${banned[0]}"`);

  /* Rule 5: "aapne bataya tha" is a lie when nothing has been said yet — but
     only until she HAS said something. Rule 3 actively wants the reply to
     restate what she just told us, so from the second turn onward this phrase
     is correct and flagging it was a false positive: the check fired on the
     codemix run for a reply restating a train journey described one turn
     earlier. It is a lie on the opener and the first reply, and nowhere else. */
  if (!hasMemories && turnIndex <= 1 && /(bataya\s+tha|बताया\s+था)/i.test(text)) {
    add("claims_prior_talk", "fail", "referred to a conversation that never happened");
  }

  /* A hint that contains the answer destroys the therapy — the reaching is
     the point. Two distinctive words shared with one stored fact is a leak,
     the same threshold server.js uses at runtime. */
  if (afterStall && knownFacts.length) {
    const words = (s) =>
      new Set(
        String(s).toLowerCase().replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter((w) => w.length > 4),
      );
    const T = words(text);
    for (const f of knownFacts) {
      let hit = 0;
      for (const w of words(`${f.statement} ${f.canonical || ""}`)) if (T.has(w)) hit++;
      if (hit >= 2) {
        add("leaked_answer", "fail", `handed back a stored fact instead of hinting: "${f.canonical || f.statement}"`);
        break;
      }
    }
  }

  /* Repetition. Saying the same thing twice to someone with memory loss is
     the failure the echo guard exists to prevent, so if it reaches here the
     guard did not hold. */
  if (prevReply && similarity(text, prevReply) >= 0.7) {
    add("echo", "fail", `repeated the previous turn (${similarity(text, prevReply).toFixed(2)} overlap)`);
  }

  /* Rule 10: under 35 words. Long speech tires her out, and every extra
     word is another second of Bulbul before the question that matters. The
     opener gets more room because it has an introduction to make and today's
     day and season to mention — measured, that is 36-40 words. */
  const words = text.split(/\s+/).filter(Boolean).length;
  const limit = turnIndex === 0 ? WORD_LIMIT + 12 : WORD_LIMIT;
  if (words > limit) add("too_long", "warn", `${words} words (limit ${limit})`);

  /* Rule 4: exactly one question per turn. Two is a quiz. */
  const questions = (text.match(/[?？]/g) || []).length;
  if (questions > 1) add("multi_question", "warn", `${questions} questions in one turn`);

  /* Rule 2: never a dead end. This is the check that found the worst thing in
     the product — "Aaj baat karte hain." with no question in it, three times
     in one six-turn run. She has nothing to answer, so she stops. */
  if (!/[?？]/.test(text)) {
    add("no_question", "fail", "nothing for her to answer — the conversation dies here");
  }

  /* Rule 0/1: once we know her name, asking again is the product forgetting
     her — the exact thing it is for.

     Requires an actual interrogative, not just the word "name". Matching
     பெயர் alone flagged "அது ஒரு அழகான பெயர்" — "that is a beautiful name",
     said about Thanjavur — as if we had asked her who she was. */
  const ASKS_NAME =
    /(kis\s+naam\s+se|aapka\s+naam\s+kya|naam\s+kya\s+hai|naam\s+bata|आपका\s+नाम\s+क्या|नाम\s+क्या\s+है|क्या\s+नाम\s+है|உங்கள்\s+பெயர்\s+என்ன|तुमचं\s+नाव\s+काय)/i;
  if (knowsName && ASKS_NAME.test(text)) {
    add("asked_name_again", "fail", "asked for a name we already had");
  }

  /* The claim on the landing page, measured. Short replies are exempt: a
     six-character answer carrying one Latin brand name scores under 50% while
     being perfectly readable, and flagging it taught us nothing. */
  if (expectLang) {
    const fit = scriptFit(text, expectLang);
    if (fit && fit.chars >= 12 && expectLang !== "hi-IN" && expectLang !== "en-IN" && fit.fit < 0.5) {
      add(
        "wrong_script",
        "fail",
        `${Math.round(fit.fit * 100)}% ${fit.script} — she cannot read this reply`,
      );
    }
  }

  /* "Output sirf bolne wala text" — anything else gets read aloud by Bulbul. */
  if (/[*#]|\p{Extended_Pictographic}/u.test(text)) {
    add("stage_direction", "warn", "markdown or emoji in text destined for TTS");
  }

  /* The model quotes itself, which broke the filler guard for months because
     FILLER_LEAD is anchored at the start of the string. Checked here with a
     plain character test rather than the guard's own regex — see below. */
  if (/^["'“”‘’«]/.test(String(reply).trim())) {
    add("wrapped_in_quotes", "fail", "reply opens with a quotation mark — TTS reads it, and it defeats the filler guard");
  }

  /* Fillers, detected INDEPENDENTLY of the guard that strips them.
     Using FILLER_LEAD here (as this check first did) can only ever pass:
     stripFillers has already removed everything that regex matches, so the
     check certified its own blind spot. This list is deliberately a separate,
     broader one — its job is to find the forms the guard does not know yet. */
  const LEADING_FILLER =
    /^(?:achha|acha|arre|are|oh|hmm|wah|waah|haan|haa+n|ji|theek\s+hai|bilkul|sahi|bahut\s+\w+|kitna\s+\w+|kya\s+baat|अच्छा|अरे|वाह|हाँ|हां|ठीक\s+है|बिल्कुल|बहुत\s+\S+|कितना\s+\S+)\b[\s,!.।…—-]*/i;
  const first = text.split(/(?<=[.?!।])\s+/)[0] || "";
  if (LEADING_FILLER.test(text)) {
    add("filler_opener", "warn", `opens with filler: "${first.slice(0, 48)}"`);
  }

  /* Rule 2: lead, never ask her to choose the subject from nothing. "aaj kya
     baat karein?" is named in the prompt as forbidden, and the model produced
     "Aaj HUM kya baat karein?" — one inserted word, straight past a regex that
     required the two to be adjacent. */
  if (/aaj\s+(?:hum\s+)?kya\s+baat\s+kar|kya\s+baat\s+karni\s+hai|आज\s+(?:हम\s+)?क्या\s+बात\s+कर/i.test(text)) {
    add("open_ended", "warn", "handed her a blank page instead of a proposal");
  }

  /* Invented places and people — the most harmful thing found in a scenario
     run so far, and the reason prompts.js gained rule 12.

     Recorded: an elder who had said only "Thanjavur" was told about
     "Thanjavur ke prasiddh Nataraja Temple" (that temple is in Chidambaram)
     and then "Thanjavur ka prasiddh Maharashtrian Mandap", which does not
     exist at all — followed by invented detail about the carving on its stone
     and the cool air beneath it. To someone who cannot check, a name Yaadein
     says becomes a memory, and an invented one is a false memory they have no
     way to correct.

     Heuristic, and a warning rather than a failure because of it: a
     capitalised word of four or more letters, NOT at the start of a sentence,
     that appears in neither her own words nor the stored facts. Sentence-
     initial capitals are excluded because romanised Hindi capitalises there
     for punctuation, not for names. */
  const known = `${elderSaid || ""} ${knownFacts.map((f) => `${f.statement} ${f.canonical || ""}`).join(" ")}`.toLowerCase();
  /* Drop the first word of every sentence. Doing this with a single replace of
     /(^|[.?!।]\s*)\S+/g did not work: \S+ swallowed the trailing punctuation
     ("Thanjavur!"), so the boundary was consumed and the NEXT sentence's first
     word survived — which is how the romanised Hindi word "Wahan" came to be
     reported as a place she had never mentioned. */
  const midSentence = text
    .split(/(?<=[.?!।])\s+/)
    .map((s) => s.split(/\s+/).slice(1).join(" "))
    .join(" ");
  const invented = [...new Set(midSentence.match(/\b[A-Z][a-z]{3,}\b/g) || [])]
    .filter((w) => !SAFE_PROPER.has(w.toLowerCase()) && !known.includes(w.toLowerCase()));
  if (invented.length) {
    add("invented_detail", "warn", `named something she never mentioned: ${invented.join(", ")}`);
  }

  return flags;
}

/* Words that get capitalised mid-sentence without being a claim about her
   life: our own name, the calendar, and the festivals the CST themes bring up
   by design. Everything else capitalised mid-sentence is a name, and a name
   has to have come from her. */
const SAFE_PROPER = new Set([
  "yaadein", "namaste", "namaskar", "vanakkam",
  "somvaar", "mangalvaar", "budhvaar", "guruvaar", "shukravaar", "shanivaar", "ravivaar",
  "diwali", "holi", "dussehra", "pongal", "onam", "eid", "sankranti", "navratri", "raksha", "bandhan",
  "hindi", "tamil", "telugu", "marathi", "bengali", "kannada", "gujarati", "malayalam", "punjabi", "odia",
]);

/** Roll per-turn flags up into something a human reads in one glance. */
function summarise(turns) {
  const counts = {};
  let fails = 0, warns = 0;
  for (const t of turns) {
    for (const f of t.flags || []) {
      counts[f.code] = (counts[f.code] || 0) + 1;
      if (f.level === "fail") fails++;
      else warns++;
    }
  }
  return { verdict: fails ? "FAIL" : warns ? "WARN" : "PASS", fails, warns, by_code: counts };
}

module.exports = {
  SCENARIOS, SIM_PREFIX, isSimPhone, scriptFit, lintReply, summarise, SCRIPTS, WORD_LIMIT,
};
