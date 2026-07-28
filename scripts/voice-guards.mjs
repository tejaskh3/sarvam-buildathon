/* Unit tests for the pure text guards that shape Yaadein's voice.

   These used to read server.js as a string, slice the function bodies out by
   searching for the next lone closing brace, and eval the result — because
   importing server.js starts an HTTP listener. That worked by accident:
   stripFillers was never named in the list, it just happened to fall inside
   the slice that began at `const FILLER =`.

   The guards now live in app/voice.js, which imports cleanly. */
import { createRequire } from "node:module";

const { stripFillers, dropDanglingRecall, dedupeParagraphs } = createRequire(import.meta.url)(
  "../app/voice.js"
);

let pass = 0,
  fail = 0;
const eq = (name, got, want) => {
  const ok = got === want;
  console.log(`${ok ? "✅" : "❌"} ${name}`);
  if (!ok) console.log(`     got:  ${JSON.stringify(got)}\n     want: ${JSON.stringify(want)}`);
  ok ? pass++ : fail++;
};

console.log("\nfiller stripping\n");

eq(
  "leading Achha comes off",
  stripFillers("Achha, aapne Pune ka zikr kiya. Wahan subah kaisi lagti thi?"),
  "Aapne Pune ka zikr kiya. Wahan subah kaisi lagti thi?"
);

eq(
  "a praise-only sentence is dropped whole",
  stripFillers("Bahut achha! Us waqt aapko kaisa lagta tha, zara bataiye?"),
  "Us waqt aapko kaisa lagta tha, zara bataiye?"
);

/* The one that matters most: "bahut achha" is filler as an interjection and
   content as a clause. Only the punctuation tells them apart. */
eq(
  "a real sentence starting with the same words survives untouched",
  stripFillers("Bahut achha lagta tha jab hum talab ke paas jaate the."),
  "Bahut achha lagta tha jab hum talab ke paas jaate the."
);

eq(
  "a stack of interjections all come off",
  stripFillers("Arre wah! Kya baat hai! Us patang ka rang kaisa tha?"),
  "Us patang ka rang kaisa tha?"
);

/* She answers in whatever language they speak, so the filler list has to cover
   those scripts too — the live demo shipped "அட, புனே!" straight to a caller. */
eq(
  "Tamil interjection comes off",
  stripFillers("அட, புனே! அந்தப் பாடல்கள் எனக்குத் தெரிந்தவை."),
  "புனே! அந்தப் பாடல்கள் எனக்குத் தெரிந்தவை."
);
eq(
  "Devanagari fillers too",
  stripFillers("अच्छा, आपने पुणे का ज़िक्र किया। वहाँ सुबह कैसी लगती थी?"),
  "आपने पुणे का ज़िक्र किया। वहाँ सुबह कैसी लगती थी?"
);

eq("a short reply still loses its filler", stripFillers("Wah, achhi baat hai."), "Achhi baat hai.");

/* Stripping must never leave her mute or mid-thought — a stump is worse than
   a filler, so a reply with nothing behind the filler keeps it. */
eq("a filler-only reply is left alone rather than emptied", stripFillers("Hmm."), "Hmm.");
eq("nothing meaningful behind the filler → keep it", stripFillers("Achha, haan."), "Achha, haan.");

console.log("\nrecall + repetition guards\n");

eq(
  "a dangling recall stub is dropped",
  dropDanglingRecall("Aapne bataya tha ki..."),
  ""
);
eq(
  "a complete recall line is kept",
  dropDanglingRecall("Aapne bataya tha ki aap Pune mein rehte hain."),
  "Aapne bataya tha ki aap Pune mein rehte hain."
);
eq(
  "a duplicated paragraph collapses",
  dedupeParagraphs("Wahan subah kaisi lagti thi?\n\nWahan subah kaisi lagti thi?"),
  "Wahan subah kaisi lagti thi?"
);

console.log(`\n${fail === 0 ? "🎉" : "🔧"} ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
