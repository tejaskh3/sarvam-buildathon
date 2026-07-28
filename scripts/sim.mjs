/* Run a conversation scenario and read the result like a transcript.
 *
 *   node scripts/sim.mjs                     → list the scenarios
 *   node scripts/sim.mjs tamil-elder         → run one
 *   node scripts/sim.mjs all                 → run every scenario, one summary line each
 *   node scripts/sim.mjs all --full          → …and print every transcript
 *   node scripts/sim.mjs returning-elder --tts   → also render Bulbul (costs credits)
 *   node scripts/sim.mjs --say "Namaste" "Mera naam Kamala hai"   → ad-hoc script
 *
 * Reads ADMIN_TOKEN and API base from app/.env, so there is nothing to pass.
 * This is a thin client: every judgement lives in app/sim.js, on the server,
 * where the demo and the test suite both reach the same one.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const env = {};
const envPath = resolve("app/.env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m) env[m[1]] = m[2];
  }
}
const API = process.env.SIM_API || env.SIM_API || "http://localhost:3000";
const TOKEN = process.env.ADMIN_TOKEN || env.ADMIN_TOKEN || "";
if (!TOKEN) {
  console.error("\n❌ No ADMIN_TOKEN. Add one to app/.env:\n   ADMIN_TOKEN=some-long-random-string\n");
  process.exit(1);
}
const H = { "x-admin-token": TOKEN, "content-type": "application/json" };

const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const args = argv.filter((a) => !a.startsWith("--"));
const FULL = flag("--full");
const TTS = flag("--tts");

const C = { dim: "\x1b[2m", off: "\x1b[0m", red: "\x1b[31m", yellow: "\x1b[33m", green: "\x1b[32m", bold: "\x1b[1m", cyan: "\x1b[36m" };
const verdictColour = (v) => (v === "FAIL" ? C.red : v === "WARN" ? C.yellow : C.green);

async function scenarios() {
  const r = await fetch(`${API}/api/sim/scenarios`, { headers: H });
  if (!r.ok) {
    console.error(`\n❌ ${r.status}: ${(await r.text()).slice(0, 200)}\n   Is the server running? (npm start)\n`);
    process.exit(1);
  }
  return (await r.json()).scenarios;
}

async function run(body) {
  const r = await fetch(`${API}/api/sim`, { method: "POST", headers: H, body: JSON.stringify(body) });
  return r.json();
}

function printTranscript(j) {
  for (const t of j.transcript || []) {
    const who = t.who === "elder" ? `${C.cyan}👵${C.off}` : "🪔";
    const ms = t.ms ? `${C.dim} ${(t.ms / 1000).toFixed(1)}s${C.off}` : "";
    console.log(`  ${who} ${t.text || `${C.dim}(nothing)${C.off}`}${ms}`);
    for (const f of t.flags || []) {
      const col = f.level === "fail" ? C.red : C.yellow;
      console.log(`      ${col}⚑ ${f.code}${C.off} ${C.dim}${f.detail}${C.off}`);
    }
  }
}

function printResult(j, { full }) {
  if (j.error) {
    console.log(`  ${C.red}✗ ${j.error}${C.off} ${j.message || JSON.stringify(j.known || j.body || "")}`);
    return false;
  }
  const lang = j.language?.opener_fit
    ? `${j.language.expected} ${Math.round(j.language.opener_fit.fit * 100)}% ${j.language.opener_fit.script}`
    : j.language?.expected || "?";
  const cn = j.contract || {};
  console.log(
    `  ${verdictColour(j.verdict)}${C.bold}${j.verdict.padEnd(4)}${C.off} ` +
    `${C.dim}${j.fails} fail · ${j.warns} warn${C.off}  ${lang}  ` +
    `${C.dim}${(j.latency_ms.total / 1000).toFixed(1)}s · captured ${j.memories.captured.length} ` +
    `· RESUMED ${cn.RESUMED ? "✓" : "·"} CAPTURED ${cn.CAPTURED ?? "·"} SAFE ${cn.SAFE === false ? "✗" : "✓"}${C.off}`,
  );
  if (Object.keys(j.by_code).length) {
    console.log(`       ${Object.entries(j.by_code).map(([k, n]) => `${k}${n > 1 ? `×${n}` : ""}`).join("  ")}`);
  }
  for (const w of j.warnings || []) console.log(`       ${C.yellow}! ${w}${C.off}`);
  if (full) printTranscript(j);
  return j.verdict !== "FAIL";
}

// ── ad-hoc script ──
const sayAt = argv.indexOf("--say");
if (sayAt !== -1) {
  const turns = argv.slice(sayAt + 1).filter((a) => !a.startsWith("--"));
  console.log(`\n${C.bold}ad-hoc${C.off} ${C.dim}${turns.length} turns${C.off}`);
  const j = await run({ turns, phone: "5000000099", tts: TTS });
  printResult(j, { full: true });
  process.exit(j.verdict === "FAIL" ? 1 : 0);
}

// ── list ──
if (!args.length) {
  const list = await scenarios();
  console.log(`\n${C.bold}scenarios${C.off} ${C.dim}(node scripts/sim.mjs <key> | all)${C.off}\n`);
  for (const s of list) {
    console.log(`  ${C.bold}${s.key.padEnd(22)}${C.off}${C.dim}${s.language}  ${s.turns} turns  ${s.seeded ? "seeded" : "fresh"}${C.off}`);
    console.log(`  ${" ".repeat(22)}${s.title}`);
    console.log(`  ${" ".repeat(22)}${C.dim}${s.hunts}${C.off}\n`);
  }
  process.exit(0);
}

// ── run ──
const keys = args[0] === "all" ? (await scenarios()).map((s) => s.key) : args;
let bad = 0;
for (const key of keys) {
  console.log(`\n${C.bold}${key}${C.off}`);
  const j = await run({ scenario: key, tts: TTS });
  if (!printResult(j, { full: FULL || keys.length === 1 })) bad++;
}
console.log(
  `\n${bad ? C.red : C.green}${C.bold}${keys.length - bad}/${keys.length} scenarios clean${C.off}\n`,
);
process.exit(bad ? 1 : 0);
