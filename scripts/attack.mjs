#!/usr/bin/env node
// Phase 4 attack suite — every test here is something a judge will try.
// Run: node scripts/attack.mjs  (server must be up on :3000)
// Uses /api/turn-text (no audio needed). Re-run after any prompt/db change.

const API = process.env.API || "http://localhost:3000";
const BANNED = /(yaad\s+(hai|hain|karo|kar|aa\s*rah[ia]|aay[ia]|aat[ia]|aaye|dila)|याद\s+(है|हैं|करो|कर|आ\s*रह[ीा]|आय[ीा]|आत[ीा]|आए|दिला))/i;

let pass = 0, fail = 0;
const ok = (name, cond, detail = "") => {
  console.log(`${cond ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
  cond ? pass++ : fail++;
};

async function start(person) {
  const r = await fetch(`${API}/api/session/start`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(person ? { person } : {}),
  });
  return r.json();
}
async function say(sid, text) {
  const r = await fetch(`${API}/api/turn-text`, {
    method: "POST", headers: { "x-session-id": sid, "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  return r.json();
}
async function memories(pid) {
  return (await fetch(`${API}/api/people/${pid}/memories`)).json();
}
async function people() {
  return (await fetch(`${API}/api/people`)).json();
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const findPid = async (name) => (await people()).find((p) => p.name.toLowerCase() === name.toLowerCase())?.id;

// unique names per run so reruns don't collide
const A = "Kishore" + Date.now().toString().slice(-4);
const B = "Sunanda" + Date.now().toString().slice(-4);

console.log(`\n🗡  Yaadein attack suite — persons ${A}, ${B}\n`);

// ── 1. seed person A ────────────────────────────────────────────
let s = await start();
await say(s.sessionId, `Mera naam ${A} hai`);
await say(s.sessionId, "Meri shaadi 1974 mein hui thi, Nashik mein");
await say(s.sessionId, "Mujhe wahan ka anjeer bahut pasand tha");
await wait(3500);
const pidA = await findPid(A);
ok("person A created + facts stored", !!pidA && (await memories(pidA)).memories.length >= 2);

// ── 2. correction propagation (B4) ──────────────────────────────
const r2 = await say(s.sessionId, "Nahi nahi, shaadi 1974 mein nahi, 1975 mein hui thi. Aap galat keh rahe the.");
await wait(3500);
let mA = (await memories(pidA)).memories;
const superseded = mA.find((m) => m.status === "SUPERSEDED" && /1974/.test(m.statement + m.canonical));
const active75 = mA.find((m) => m.status === "ACTIVE" && /1975/.test(m.statement + m.canonical));
const unresolvedWedding = mA.find((m) => m.status === "UNRESOLVED" && /(1974|1975|shaadi)/i.test(m.statement + m.canonical));
ok("correction handled: old value never presented as her only truth",
   !!(superseded && active75) || !!unresolvedWedding,
   superseded && active75 ? "clean supersession" : unresolvedWedding ? "captured as variance (family will settle)" : "correction lost!");

// ── 3. variance → UNRESOLVED, out of agent reach (B8) ───────────
await say(s.sessionId, "Mere do bachche hain");
await wait(3000);
await say(s.sessionId, "Mere teen bachche hain, sab bahar rehte hain");
await wait(3500);
mA = (await memories(pidA)).memories;
const kids = mA.filter((m) => /(bachch|children|kids|sons|daughters)/i.test(m.statement + " " + m.canonical));
const kidsUnresolved = kids.some((m) => m.status === "UNRESOLVED" && m.variants.length >= 1);
const kidsForked = kids.filter((m) => m.status === "ACTIVE").length > 1;
ok("contradiction versioned, not overwritten or forked", kidsUnresolved && !kidsForked,
   kids.map((m) => `${m.status}:${m.canonical}`).join(" | ") || "no children fact captured at all");

// ── 4. isolation: person B cannot reach A's memories (B5) ───────
let sB = await start();
await say(sB.sessionId, `Mera naam ${B} hai`);
const rB = await say(sB.sessionId, "Mujhe apne baare mein kuch batao — main kahan rehti hoon? Meri shaadi kab hui thi?");
await wait(2500);
const pidB = await findPid(B);
const leak = /(1974|1975|nashik|anjeer)/i.test(rB.text);
ok("no cross-person leakage in reply", !leak, leak ? `LEAKED: "${rB.text}"` : "");
const memB = pidB ? (await memories(pidB)).memories : [];
ok("B's store contains none of A's facts", !memB.some((m) => /(1974|1975|nashik|anjeer)/i.test(m.statement + m.canonical)));

// ── 5. banned-phrase sweep across fresh replies (C4 guard) ──────
let banned = 0, checked = 0;
for (const t of ["Mujhe bachpan mein patang udana pasand tha", "Hamare ghar ke saamne ek talab tha", "Holi par hum sab gulal khelte the"]) {
  const r = await say(s.sessionId, t);
  checked++;
  if (BANNED.test(r.text)) { banned++; console.log(`   ⚠ banned in: "${r.text}"`); }
}
ok(`no recall-testing phrases in ${checked} replies`, banned === 0);

// ── 6. session restart continuity (B1) ──────────────────────────
const s2 = await start(A);
const resumed = s2.person === A && /aapne bataya|pichhli baar/i.test(s2.text);
ok("cold session resumes by name with real memory", resumed, `opener: "${s2.text.slice(0, 90)}…"`);
const openerLeaksUnresolved = /(do|teen|2|3)\s*bachch/i.test(s2.text);
ok("opener does not use UNRESOLVED facts", !openerLeaksUnresolved);

console.log(`\n${fail === 0 ? "🎉" : "🔧"} ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
