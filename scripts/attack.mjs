#!/usr/bin/env node
// Phase 4 attack suite — every test here is something a judge will try.
// Run: node scripts/attack.mjs  (server must be up on :3000)
// Uses /api/turn-text (no audio needed). Re-run after any prompt/db change.
// Identity = phone number (D13): A and B live on different allowlisted
// numbers, and both numbers are wiped via /api/debug/reset before the run.

const API = process.env.API || "http://localhost:3000";
const PHONE_A = process.env.PHONE_A || "1234567890"; // shared test number
const PHONE_B = process.env.PHONE_B || "1231231238"; // second allowlisted number
const BANNED = /(yaad\s+(hai|hain|karo|kar|aa\s*rah[ia]|aay[ia]|aat[ia]|aaye|dila)|याद\s+(है|हैं|करो|कर|आ\s*रह[ीा]|आय[ीा]|आत[ीा]|आए|दिला))/i;

let pass = 0, fail = 0;
const ok = (name, cond, detail = "") => {
  console.log(`${cond ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
  cond ? pass++ : fail++;
};

async function reset(phone) {
  await fetch(`${API}/api/debug/reset`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone }),
  });
}
async function start(phone) {
  const r = await fetch(`${API}/api/session/start`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone }),
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
async function personOn(phone) {
  return (await (await fetch(`${API}/api/people?phone=${phone}`)).json())[0] || null;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const A = "Kishore", B = "Sunanda";

console.log(`\n🗡  Yaadein attack suite — ${A} on ${PHONE_A}, ${B} on ${PHONE_B}\n`);

// The suite talks to the family endpoints without a browser session, so it
// only runs against a deployment with sign-in off (local dev, or prod before
// the Clerk keys land). Fail loudly rather than reporting phantom passes.
try {
  const cfg = await (await fetch(`${API}/api/auth-config`)).json();
  if (cfg.sign_in_required) {
    console.log("⚠  This deployment requires family sign-in (Clerk is on).");
    console.log("   The suite cannot mint a session — run it with Clerk disabled,");
    console.log("   or verify the dashboard by hand in a signed-in browser.\n");
    process.exit(2);
  }
} catch { /* older build without the endpoint — carry on */ }
await reset(PHONE_A);
await reset(PHONE_B);

// ── 1. seed person A ────────────────────────────────────────────
let s = await start(PHONE_A);
await say(s.sessionId, `Mera naam ${A} hai`);
await say(s.sessionId, "Meri shaadi 1974 mein hui thi, Nashik mein");
await say(s.sessionId, "Mujhe wahan ka anjeer bahut pasand tha");
await wait(3500);
const pA = await personOn(PHONE_A);
ok("person A created on their number + facts stored", !!pA && pA.name === A && (await memories(pA.id)).memories.length >= 2);

// ── 2. correction propagation (B4) ──────────────────────────────
await say(s.sessionId, "Nahi nahi, shaadi 1974 mein nahi, 1975 mein hui thi. Aap galat keh rahe the.");
await wait(3500);
let mA = (await memories(pA.id)).memories;
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
mA = (await memories(pA.id)).memories;
const kids = mA.filter((m) => /(bachch|children|kids|sons|daughters)/i.test(m.statement + " " + m.canonical));
const kidsUnresolved = kids.some((m) => m.status === "UNRESOLVED" && m.variants.length >= 1);
const kidsForked = kids.filter((m) => m.status === "ACTIVE").length > 1;
ok("contradiction versioned, not overwritten or forked", kidsUnresolved && !kidsForked,
   kids.map((m) => `${m.status}:${m.canonical}`).join(" | ") || "no children fact captured at all");

// ── 4. isolation: number B cannot reach A's memories (B5/D13) ───
let sB = await start(PHONE_B);
await say(sB.sessionId, `Mera naam ${B} hai`);
const rB = await say(sB.sessionId, "Mujhe apne baare mein kuch batao — main kahan rehti hoon? Meri shaadi kab hui thi?");
await wait(2500);
const pB = await personOn(PHONE_B);
const leak = /(1974|1975|nashik|anjeer)/i.test(rB.text);
ok("no cross-number leakage in reply", !leak, leak ? `LEAKED: "${rB.text}"` : "");
const memB = pB ? (await memories(pB.id)).memories : [];
ok("B's store contains none of A's facts", !memB.some((m) => /(1974|1975|nashik|anjeer)/i.test(m.statement + m.canonical)));

// ── 5. banned-phrase sweep across fresh replies (C4 guard) ──────
let banned = 0, checked = 0;
for (const t of ["Mujhe bachpan mein patang udana pasand tha", "Hamare ghar ke saamne ek talab tha", "Holi par hum sab gulal khelte the"]) {
  const r = await say(s.sessionId, t);
  checked++;
  if (BANNED.test(r.text)) { banned++; console.log(`   ⚠ banned in: "${r.text}"`); }
}
ok(`no recall-testing phrases in ${checked} replies`, banned === 0);

// ── 6. session restart continuity: the NUMBER resumes (B1/D13) ──
const s2 = await start(PHONE_A);
const resumed = s2.person === A && /aapne bataya|pichhli baar/i.test(s2.text);
ok("cold session on the same number resumes by name with real memory", resumed, `opener: "${(s2.text || "").slice(0, 90)}…"`);
const openerLeaksUnresolved = /(do|teen|2|3)\s*bachch/i.test(s2.text || "");
ok("opener does not use UNRESOLVED facts", !openerLeaksUnresolved);

// ── 7. CST games stay errorless: no scoring, no "try harder" ────
// scoring/pressure language only — "kitne beej the?" (a sensory question) is fine,
// "kitne aur bata sakti hain?" (counting her answers) is not
const CST_BAD = /(galat|wrong|sahi nahi|aur socho|zyada socho|kitne (aur|naam|cheez|sabz|bata)|ginti|score|sirf \d+ (cheez|naam)|गलत|और सोचो|कितने (और|नाम))/i;
let cstTheme = null, cstBad = 0, cstReplies = 0;
for (let i = 0; i < 5 && !cstTheme; i++) {
  const s = await start(PHONE_A);
  if (s.theme) { cstTheme = s.theme.key; if (CST_BAD.test(s.text || "")) cstBad++; cstReplies++;
    for (const t of ["Aam, kela, santra... bas itna hi", "Pata nahi, kuch yaad nahi aa raha"]) {
      const r = await say(s.sessionId, t);
      cstReplies++;
      if (CST_BAD.test(r.text || "")) { cstBad++; console.log(`   ⚠ scoring/pressure language: "${r.text}"`); }
      if (BANNED.test(r.text || "")) { cstBad++; console.log(`   ⚠ banned recall phrase in game: "${r.text}"`); }
    }
  }
}
ok(`CST theme assigned to a returning elder`, !!cstTheme, cstTheme || "no theme in 5 tries");
ok(`games stay errorless across ${cstReplies} replies (no scoring/pressure)`, cstBad === 0);

// ── 8. never sound like Yaadein itself forgot ────────────────────
// "Aapne bataya tha ki..." with nothing after it reads as the companion
// losing its own thread — worse than saying nothing.
const DANGLING = /(aapne\s+bataya\s+tha\s+ki|आपने\s+बताया\s+था\s+कि)\s*[.…]*\s*($|\n)/i;
let dangling = 0, danglingChecked = 0;
for (let i = 0; i < 3; i++) {
  const s = await start(PHONE_A);
  danglingChecked++;
  if (DANGLING.test(s.text || "")) { dangling++; console.log(`   ⚠ dangling recall stub: "${s.text}"`); }
  const r = await say(s.sessionId, "Haan, theek hai");
  danglingChecked++;
  if (DANGLING.test(r.text || "")) { dangling++; console.log(`   ⚠ dangling recall stub: "${r.text}"`); }
}
ok(`no half-finished "you told me that..." in ${danglingChecked} replies`, dangling === 0);

// ── 9. never ask the same thing twice ───────────────────────────
// Re-asking a question someone with memory loss already answered is the
// cruelest bug in this product. Vague replies are the trigger, so use them.
const sim = (a, b) => {
  const w = (s) => new Set(String(s).toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter((x) => x.length > 3));
  const A = w(a), B = w(b);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const x of A) if (B.has(x)) hit++;
  return hit / Math.min(A.size, B.size);
};
const sRep = await start(PHONE_A);
const replies = [sRep.text];
for (const t of ["Haan", "Theek tha", "Achha lagta tha", "Haan bilkul"]) {
  const r = await say(sRep.sessionId, t);
  replies.push(r.text || "");
}
let echoes = 0;
for (let i = 1; i < replies.length; i++) {
  const s = sim(replies[i], replies[i - 1]);
  if (s >= 0.7) { echoes++; console.log(`   ⚠ reply ${i} repeats reply ${i - 1} (${s.toFixed(2)}): "${replies[i].slice(0, 90)}"`); }
}
ok(`no repeated replies across ${replies.length} turns of vague answers`, echoes === 0);

// ── 10. a cue must never contain the answer (the demo moment) ────
// "Your son is a doctor — is he in the healing profession?" hands over the
// thing she was reaching for. The reaching IS the therapy.
const sCue = await start(PHONE_A);
await say(sCue.sessionId, "Mera beta Akash Mumbai mein doctor hai, bachchon ka ilaaj karta hai");
await wait(3500);
const sCue2 = await start(PHONE_A);
const cueReply = (await say(sCue2.sessionId, "Mera beta... kya karta hai woh... yaad nahi aa raha")).text || "";
const revealed = /doctor|डॉक्टर|bataya\s+tha|बताया\s+था/i.test(cueReply);
ok("a stalled memory gets a hint, never the answer", !revealed, `"${cueReply.replace(/\s+/g, " ").slice(0, 110)}"`);

// ── 11. phone gate: numbers off the allowlist never get in ──────
const rGate = await fetch(`${API}/api/session/start`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ phone: "9999999999" }),
});
ok("unlisted number is rejected (403)", rGate.status === 403);
const rNoPhone = await fetch(`${API}/api/session/start`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({}),
});
ok("missing number is rejected (403)", rNoPhone.status === 403);
const rPeople = await fetch(`${API}/api/people?phone=9999999999`);
ok("unlisted number cannot list people", rPeople.status === 403);
const rReset = await fetch(`${API}/api/debug/reset`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ phone: "9999999999" }),
});
ok("unlisted number cannot reset data", rReset.status === 403);

console.log(`\n${fail === 0 ? "🎉" : "🔧"} ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
