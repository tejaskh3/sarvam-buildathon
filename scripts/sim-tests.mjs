/* The conversation guards, and the checks that police them.
   Run: node scripts/sim-tests.mjs

   Every case below is a real reply that sarvam-30b produced during a recorded
   scenario run (scripts/sim.mjs) and that reached — or would have reached — an
   elder's screen. That provenance is the point: these are not invented inputs,
   they are regressions. */
import { createRequire } from "node:module";
const require_ = createRequire(import.meta.url);
const {
  stripFillers, stripWrappingQuotes, lastQuestion, hasQuestion, keepTheFloor, repeatsPrevious,
  openQuestionAbout,
} = require_("../app/voice.js");
const { lintReply, scriptFit, summarise } = require_("../app/sim.js");

let pass = 0, fail = 0;
const ok = (name, cond, detail = "") => {
  console.log(`${cond ? "✅" : "❌"} ${name}`);
  if (!cond && detail) console.log(`     ${detail}`);
  cond ? pass++ : fail++;
};
const codes = (flags) => flags.map((f) => f.code);

console.log("\nthe model quotes itself, and it broke the filler guard\n");

/* Observed verbatim, first-meeting run. The leading mark has no closing pair;
   Bulbul reads the text as-is and the memoir keeps the quote. */
ok("a wrapping quote is removed",
   stripWrappingQuotes('"Aapka swagat hai. Aaj hum baat karte hain.') === "Aapka swagat hai. Aaj hum baat karte hain.",
   stripWrappingQuotes('"Aapka swagat hai.'));
ok("curly quotes too", stripWrappingQuotes("“Namaste, Kamala ji.”") === "Namaste, Kamala ji.");
ok("a quote INSIDE the reply survives — that is her own words being repeated",
   stripWrappingQuotes('Aapne kaha "aam ka ped" — uski khushboo kaisi thi?').includes('"aam ka ped"'));

/* The regression that motivated all of this: FILLER_LEAD is anchored at ^, so
   one leading quotation mark disabled filler stripping for the whole reply. */
ok("a quoted filler is still stripped (the anchored-regex bug)",
   !/^\s*"?\s*Wah/i.test(stripFillers('"Thanjavur! Wah, kitna sundar naam hai. Wahan subah kaisi lagti thi?')),
   stripFillers('"Thanjavur! Wah, kitna sundar naam hai. Wahan subah kaisi lagti thi?'));

console.log("\nfillers the guard used to miss\n");

const strippedCases = [
  ["mid-reply praise sentence", "Aam ka ped! Bahut achha. Uski khushboo kaisi hoti thi?", /bahut achha/i],
  ["bare agreement opener", "Haan haan, woh ghantiyaan door tak sunai deti thin. Aapke ghar ke paas mandir tha?", /^haan haan/i],
  ["theek hai as a whole sentence", "Theek hai. Wahan ki subah kaisi lagti thi?", /^theek hai\./i],
  ["kitna sundar", "Kitna sundar. Wahan subah kaisi lagti thi?", /^kitna sundar/i],
];
for (const [label, input, mustGo] of strippedCases) {
  const out = stripFillers(input);
  ok(`${label} is gone`, !mustGo.test(out), `got: "${out}"`);
  ok(`${label} — the substance survives`, /\?/.test(out) && out.length > 12, `got: "${out}"`);
}

/* The guard must never whittle a reply down to nothing. */
ok("a reply that is ONLY filler still says something",
   stripFillers("Haan haan.").length > 0, stripFillers("Haan haan."));
ok("a reply with no filler is untouched",
   stripFillers("Wahan subah kaisi lagti thi?") === "Wahan subah kaisi lagti thi?");

console.log("\nnever a dead end\n");

/* Observed: three of six replies in the monosyllabic run had no question at
   all. She has nothing to answer, so she stops, so the session ends. */
ok("a reply with no question is detected", !hasQuestion("Aaj baat karte hain."));
ok("a reply with a question passes", hasQuestion("Wahan subah kaisi lagti thi?"));
ok("keepTheFloor reflects her words when there are any",
   keepTheFloor("hum talab ke paas patang udate the").includes("talab"),
   keepTheFloor("hum talab ke paas patang udate the"));
ok("keepTheFloor proposes two named topics when she gave us nothing",
   /\?/.test(keepTheFloor("Haan.")) && keepTheFloor("Haan.").length > 20,
   keepTheFloor("Haan."));
ok("keepTheFloor never returns a dead end", ["Haan.", "", "Achha.", "Hmm."].every((s) => hasQuestion(keepTheFloor(s))));

/* Both of these shipped once the no-question guard started firing, which is
   how a fix finds the next bug: the guard appended a question built by
   reflecting her words, and her words were "Theek hai." */
ok("filler is never reflected back as if it were something she told us",
   !/theek hai —/i.test(openQuestionAbout("Theek hai.")) && !/haan haan —/i.test(openQuestionAbout("Haan haan.")),
   openQuestionAbout("Theek hai."));
ok("real content still gets reflected",
   openQuestionAbout("hum talab ke paas patang udate the").startsWith("hum talab ke paas"));
/* The last-resort turn used to be one fixed sentence, so two consecutive
   fall-throughs asked the identical question — the guard against repetition
   repeating itself. Observed: "Us waqt aapko kaisa lagta tha?" twice in a row. */
ok("consecutive last-resort turns cannot repeat",
   openQuestionAbout("Haan.", 4) !== openQuestionAbout("Achha.", 5),
   `${openQuestionAbout("Haan.", 4)} / ${openQuestionAbout("Achha.", 5)}`);
ok("every rotation is still a question", [0, 1, 2, 3, 4].every((i) => hasQuestion(openQuestionAbout("Haan.", i))));

console.log("\ninvented places are false memories\n");

/* Recorded: an elder who had said only "Thanjavur" was told about a
   "Maharashtrian Mandap" there, with invented detail about its stonework. */
const inventedFlags = codes(lintReply({
  reply: "Thanjavur ka prasiddh Maharashtrian Mandap kaisa dikhta hoga?",
  elderSaid: "Main Thanjavur mein badi hui thi.",
  turnIndex: 3,
}));
ok("a place she never mentioned is flagged", inventedFlags.includes("invented_detail"), inventedFlags.join(","));
ok("a place she DID mention is not flagged",
   !codes(lintReply({ reply: "Wahan Thanjavur mein subah kaisi lagti thi?", elderSaid: "Main Thanjavur mein badi hui.", turnIndex: 3 })).includes("invented_detail"));
ok("a stored fact counts as hers too",
   !codes(lintReply({
     reply: "Aapke bete Akash ka kaam kaisa chal raha hai?",
     elderSaid: "Haan.", turnIndex: 3,
     knownFacts: [{ statement: "Mera beta Akash doctor hai", canonical: "Son Akash is a doctor" }],
   })).includes("invented_detail"));
ok("her own name, given by the family at signup, is not an invention",
   !codes(lintReply({ reply: "Namaste Kamala ji. Wahan kaisa tha? Kaisa laga?", elderSaid: "Kamala", turnIndex: 0 })).includes("invented_detail"));
ok("our own name and the weekday are not inventions",
   !codes(lintReply({ reply: "Main Yaadein hoon, aaj Mangalvaar hai. Kaisa laga?", elderSaid: "", turnIndex: 3 })).includes("invented_detail"));
ok("a sentence-initial capital is not treated as a name",
   !codes(lintReply({ reply: "Wahan kaisa tha? Bahut sundar lagta hoga. Kaisa laga?", elderSaid: "", turnIndex: 3 })).includes("invented_detail"));

console.log("\nthe same question twice is the thing we must never do\n");

/* Observed in the codemix run: two consecutive replies with different openings
   and the identical closing question. Whole-reply similarity was ~0.4, so the
   echo guard passed it through. */
const a = "Delhi! Wahan ki bheed aur shor bahut hota hoga. Aapka ghar Delhi mein tha?";
const b = "Haan, station par bheed toh hoti hi hai. Family ke saath manage kar lete the. Aapka ghar Delhi mein tha?";
ok("lastQuestion pulls the closing question out", lastQuestion(a) === "Aapka ghar Delhi mein tha?", lastQuestion(a));
ok("a repeated closing question is caught even when the replies differ", repeatsPrevious(b, a));
ok("two genuinely different questions are not flagged",
   !repeatsPrevious("Wahan subah kaisi lagti thi?", "Aapka ghar Delhi mein tha?"));
ok("a wholesale repeat is still caught",
   repeatsPrevious("Wahan ki subah kaisi lagti thi?", "Wahan ki subah kaisi lagti thi?"));
ok("a reply with no question at all does not crash the check",
   repeatsPrevious("Aaj baat karte hain.", "Theek hai.") === false ||
   repeatsPrevious("Aaj baat karte hain.", "Theek hai.") === true);

console.log("\nscript fit — the landing page's claim, measured\n");

/* This returned 1.58 ("158% Tamil") before combining marks were counted in the
   denominator, which is how the bug announced itself. */
const tamil = scriptFit("வணக்கம் கமலா, நான் Yaadein.", "ta-IN");
ok("a fit is never above 1", tamil.fit <= 1, JSON.stringify(tamil));
/* 0.68, not 0.95: "Yaadein" is seven Latin characters of the twenty-two, and
   the brand name stays in Latin everywhere except Hindi and Marathi on
   purpose (brandIn). This is why the fail threshold is 0.5 and not 0.9. */
ok("Tamil text reads as mostly Tamil", tamil.fit > 0.65, JSON.stringify(tamil));
ok("a whole Tamil reply with no brand name scores near 1",
   scriptFit("உங்கள் குழந்தைப் பருவ வீடு பற்றிச் சொல்லுங்கள்.", "ta-IN").fit === 1);
ok("Devanagari does not pass as Tamil", scriptFit("नमस्कार, मी सुनंदा.", "ta-IN").fit < 0.1);
ok("Marathi reads as Devanagari", scriptFit("नमस्कार, मी सुनंदा.", "mr-IN").fit > 0.9);
ok("no letters at all is not a score", scriptFit("?? 123", "ta-IN") === null);

console.log("\nthe checks must not cry wolf\n");

/* Each of these fired on a correct reply during the first real run. A checker
   that flags good behaviour gets ignored, and then it is worth nothing. */
ok("'that is a beautiful name' is NOT asking her name again",
   !codes(lintReply({ reply: "தஞ்சாவூர். அது ஒரு அழகான பெயர். அது எப்படி இருந்தது?", knowsName: true, expectLang: "ta-IN", turnIndex: 2 })).includes("asked_name_again"));
ok("actually asking her name again IS caught",
   codes(lintReply({ reply: "Main aapko kis naam se bulaoon?", knowsName: true, turnIndex: 3 })).includes("asked_name_again"));
ok("restating what she said one turn ago is not a false 'prior talk' claim",
   !codes(lintReply({ reply: "Aapne bataya tha ki Delhi gaye the. Wahan kaisa laga?", hasMemories: false, turnIndex: 3 })).includes("claims_prior_talk"));
ok("claiming a shared past in the FIRST reply is caught",
   codes(lintReply({ reply: "Aapne bataya tha ki aap Pune mein rehti hain. Kaisa laga?", hasMemories: false, turnIndex: 1 })).includes("claims_prior_talk"));
/* The opener has an introduction to make and today's day and season to
   mention; measured across runs that lands at 36-40 words, so holding it to
   the same 35 as an ordinary turn only ever produced noise. */
const fortyWords = `Namaste Kamala ji. ${"shabd ".repeat(37)}Kaisa laga?`;
ok("the opener gets room for its introduction",
   !codes(lintReply({ reply: fortyWords, turnIndex: 0 })).includes("too_long"));
ok("an ordinary turn does not get that room",
   codes(lintReply({ reply: fortyWords, turnIndex: 2 })).includes("too_long"));
ok("a short reply is not flagged for script",
   !codes(lintReply({ reply: "Yaadein.", expectLang: "ta-IN", turnIndex: 2 })).includes("wrong_script"));

console.log("\nthe checks must catch what they are for\n");

ok("a recall test reaching her is a fail",
   codes(lintReply({ reply: "Aapko yaad hai wo gaon kaunsa tha?", turnIndex: 2 })).includes("banned_recall"));
ok("a dead end is a fail",
   codes(lintReply({ reply: "Aaj baat karte hain.", turnIndex: 2 })).includes("no_question"));
ok("a wrapped quote is a fail",
   codes(lintReply({ reply: '"Namaste, Kamala ji. Kaisa laga?', turnIndex: 2 })).includes("wrapped_in_quotes"));
ok("a hint that hands back the answer is a fail",
   codes(lintReply({
     reply: "Koi baat nahi. Aapka beta Akash doctor hai Mumbai mein, yaad aaya?",
     afterStall: true, turnIndex: 2,
     knownFacts: [{ statement: "Mera beta Akash Mumbai mein doctor hai", canonical: "Son Akash is a doctor in Mumbai" }],
   })).includes("leaked_answer"));
ok("a Tamil elder answered in Devanagari is a fail",
   codes(lintReply({ reply: "नमस्कार, आज कैसा लग रहा है आपको बताइए ज़रा?", expectLang: "ta-IN", turnIndex: 2 })).includes("wrong_script"));
ok("two questions in one turn is a warning",
   codes(lintReply({ reply: "Aapka din kaisa raha? Kuch achha hua?", turnIndex: 2 })).includes("multi_question"));
ok("a filler opener is a warning",
   codes(lintReply({ reply: "Bahut achha lagta hai. Wahan subah kaisi thi?", turnIndex: 2 })).includes("filler_opener"));

console.log("\nthe roll-up\n");
const rolled = summarise([
  { flags: [{ code: "no_question", level: "fail" }] },
  { flags: [{ code: "too_long", level: "warn" }, { code: "too_long", level: "warn" }] },
]);
ok("one fail makes the whole run FAIL", rolled.verdict === "FAIL" && rolled.fails === 1 && rolled.warns === 2, JSON.stringify(rolled));
ok("warnings alone are a WARN", summarise([{ flags: [{ code: "too_long", level: "warn" }] }]).verdict === "WARN");
ok("a clean run is a PASS", summarise([{ flags: [] }]).verdict === "PASS");

console.log(`\n${fail === 0 ? "🎉" : "🔧"} ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
