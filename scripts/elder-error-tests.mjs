/* The elder must never be shown a technical error.
   Run: node scripts/elder-error-tests.mjs

   This guards landing-page/src/try/errors.ts, which exists because both voice
   transports used to do `setError(e.message)` — putting `NotAllowedError:
   Permission denied` and `Failed to fetch` in front of someone with memory
   loss, on the one screen designed to ask nothing of them.

   The module is TypeScript, so it is compiled with the project's own tsc into a
   temp directory and imported. Not regex-stripped: a hand-rolled transform is
   how a test ends up asserting against code that isn't what ships. */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const out = mkdtempSync(join(tmpdir(), "yaadein-err-"));
const tsc = resolve("landing-page/node_modules/.bin/tsc");
execFileSync(tsc, [
  resolve("landing-page/src/try/errors.ts"),
  "--outDir", out,
  "--module", "esnext",
  "--target", "es2022",
  "--moduleResolution", "bundler",
], { stdio: "pipe" });

const { elderError, isMicBlocked } = await import(pathToFileURL(join(out, "errors.js")).href);

let pass = 0, fail = 0;
const ok = (name, cond, detail = "") => {
  console.log(`${cond ? "✅" : "❌"} ${name}`);
  if (!cond && detail) console.log(`     ${detail}`);
  cond ? pass++ : fail++;
};

const domEx = (name, msg) => { const e = new Error(msg); e.name = name; return e; };

/* Every failure the elder's screen can actually produce: the three getUserMedia
   refusals, a dropped fetch, our own upstream limits, and something unforeseen. */
const CASES = [
  ["microphone denied", domEx("NotAllowedError", "Permission denied"), /allow the microphone/i],
  ["no microphone", domEx("NotFoundError", "Requested device not found"), /no microphone/i],
  ["microphone in use", domEx("NotReadableError", "Could not start audio source"), /using the microphone/i],
  ["insecure origin", domEx("SecurityError", "getUserMedia blocked"), /allow the microphone/i],
  ["network dropped", new TypeError("Failed to fetch"), /connection dropped/i],
  ["sarvam throttled", new Error("stt 429: rate limit exceeded"), /lot of people/i],
  ["upstream 5xx", new Error("sarvam 502: bad gateway"), /our end/i],
  ["something unforeseen", new Error("kaboom_internal_xyz"), /something went wrong/i],
  ["a bare string", "boom", /something went wrong/i],
  ["null", null, /something went wrong/i],
];

console.log("\nevery failure becomes a sentence, and says what to do next\n");

/* The words that must never survive into what the elder reads. */
const LEAK = /Error\b|NotAllowed|NotFound|NotReadable|SecurityError|fetch|\b429\b|\b5\d\d\b|kaboom|rate limit|bad gateway|undefined|null|\[object/i;

for (const [label, err, expect] of CASES) {
  const msg = elderError(err);
  ok(`${label} — no technical detail leaks`, !LEAK.test(msg), msg);
  ok(`${label} — says what to do`, expect.test(msg), msg);
  /* A dead end is worse than an error: every message has to name an action. */
  ok(`${label} — names an action`, /tap|allow|close|plug|wait/i.test(msg), msg);
}

console.log("\nthe promises the copy makes must stay true\n");

/* Turns already finished are saved server-side; only the sentence in flight is
   lost. So "what you said before is safe" is honest for a mid-turn failure and
   would be a lie if we ever said it about a mic that never opened. */
ok("a failed mic does NOT claim earlier words are safe",
   !/is safe/i.test(elderError(domEx("NotAllowedError", "denied"))),
   elderError(domEx("NotAllowedError", "denied")));
ok("a dropped connection DOES reassure them",
   /is safe/i.test(elderError(new TypeError("Failed to fetch"))));

ok("isMicBlocked spots the browser withholding the mic",
   isMicBlocked(domEx("NotAllowedError", "x")) && isMicBlocked(domEx("SecurityError", "x")));
ok("isMicBlocked is not fooled by a network error", !isMicBlocked(new TypeError("Failed to fetch")));

rmSync(out, { recursive: true, force: true });
console.log(`\n${fail === 0 ? "🎉" : "🔧"} ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
