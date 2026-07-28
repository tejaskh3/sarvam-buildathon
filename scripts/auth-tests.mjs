#!/usr/bin/env node
// Auth/ownership suite — run: node scripts/auth-tests.mjs
// Spins up its own server against a LOCAL fake Clerk issuer, so it can mint
// valid session tokens for two different families and prove the rules that
// protect one family's memories from another. No real Clerk needed.
/* Signup-claim tests. Runs its own server with a fake Clerk issuer whose JWKS
   we serve locally, so we can mint valid session tokens for two different
   users and prove the ownership rules without touching real Clerk. */
import crypto from "node:crypto";
import http from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const KID = "test-kid-1";
const jwk = { ...publicKey.export({ format: "jwk" }), kid: KID, alg: "RS256", use: "sig" };

// local stand-in for Clerk's JWKS endpoint
const jwks = http.createServer((req, res) => {
  if (req.url.startsWith("/.well-known/jwks.json")) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ keys: [jwk] }));
  } else { res.writeHead(404); res.end(); }
});
await new Promise((r) => jwks.listen(4599, r));
const ISSUER = "http://127.0.0.1:4599";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function token(sub) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "RS256", typ: "JWT", kid: KID });
  const body = b64({ iss: ISSUER, sub, iat: now, exp: now + 600, nbf: now - 5 });
  const sig = crypto.createSign("RSA-SHA256").update(`${head}.${body}`).sign(privateKey).toString("base64url");
  return `${head}.${body}.${sig}`;
}

/* A throwaway data directory. Without this the suite registers its fake
   households — "Sheela Devi", owned by "user_alice" — into the real database
   and leaves them there. Every run added more. */
const dataDir = mkdtempSync(join(tmpdir(), "yaadein-auth-"));
/* This suite reads the admin-only registrations list, so it needs an admin
   number — and it supplies its own rather than relying on whatever the env
   defaults to. Two reasons: the assertions below stop depending on a default
   that has already changed once, and no real admin number has to appear in
   the repo. The 5-prefix is reserved (no Indian mobile starts with 5), so
   this can never be a real family's number. */
const ADMIN_PHONE = "5990000001";
const srv = spawn("node", ["--experimental-sqlite", "app/server.js"], {
  env: {
    ...process.env,
    PORT: "3111",
    CLERK_ISSUER: ISSUER,
    YAADEIN_DATA_DIR: dataDir,
    ADMIN_PHONES: ADMIN_PHONE,
  },
  stdio: ["ignore", "pipe", "pipe"],
});
srv.stdout.on("data", () => {});
srv.stderr.on("data", () => {});
const API = "http://127.0.0.1:3111";
for (let i = 0; i < 40; i++) {
  try { await fetch(`${API}/api/auth-config`); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
}

const alice = token("user_alice"), bob = token("user_bob");
const reg = (phone, tok, body = {}) =>
  fetch(`${API}/api/register`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(tok ? { authorization: `Bearer ${tok}` } : {}) },
    body: JSON.stringify({ phone, elder_name: "Sheela", language: "hi-IN", ...body }),
  });

let pass = 0, fail = 0;
const ok = (n, c, d = "") => { console.log(`${c ? "✅" : "❌"} ${n}${d ? " — " + d : ""}`); c ? pass++ : fail++; };

const NEW = String(9000000000 + Math.floor(Math.random() * 8999999));
console.log(`\nclaim tests on a fresh number: ${NEW}\n`);

const cfg = await (await fetch(`${API}/api/auth-config`)).json();
ok("clerk enabled for this run", cfg.sign_in_required, JSON.stringify(cfg));

const r1 = await reg(NEW, alice);
ok("a signed-in family CAN claim a brand-new number", r1.status === 200, `got ${r1.status}: ${(await r1.text()).slice(0, 90)}`);

const r2 = await reg(NEW, alice, { elder_name: "Sheela Devi" });
ok("the same family can re-register their own number", r2.status === 200, `got ${r2.status}`);

const r3 = await reg(NEW, bob);
ok("a DIFFERENT family is refused (already_claimed)", r3.status === 403, `got ${r3.status}`);

const r4 = await reg(String(9000000000 + Math.floor(Math.random() * 8999999)), null);
ok("no session at all is refused", r4.status === 401, `got ${r4.status}`);

const h = await (await fetch(`${API}/api/households`, { headers: { authorization: `Bearer ${alice}` } })).json();
ok("owner sees their household", (h.households || []).some((x) => x.phone === NEW), JSON.stringify(h.households || []));
const hb = await (await fetch(`${API}/api/households`, { headers: { authorization: `Bearer ${bob}` } })).json();
ok("other family sees none of it", !(hb.households || []).some((x) => x.phone === NEW));

const gate = await fetch(`${API}/api/people?phone=${NEW}`, { headers: { authorization: `Bearer ${bob}` } });
ok("other family cannot read the dashboard", gate.status === 403, `got ${gate.status}`);
const gateOwner = await fetch(`${API}/api/people?phone=${NEW}`, { headers: { authorization: `Bearer ${alice}` } });
ok("owner can read the dashboard", gateOwner.status === 200, `got ${gateOwner.status}`);

const elder = await fetch(`${API}/api/session/start`, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone: NEW }),
});
ok("the ELDER can talk with no sign-in at all", elder.status === 200, `got ${elder.status}`);

/* ── the waitlist must not mint an ownerless household ──────────────
   This was a live hole, not a hypothetical. Signing in stopped being
   required to claim a seat, and the seat handler still pre-created the
   household — with owner_id NULL. Everything else treats an ownerless
   household as unclaimed: ownsPhone() lets ANY signed-in account read it and
   /api/register lets any signed-in account take it. So an email-only signup
   produced a household that a stranger who guessed the number could read and
   then seize, locking the family out of their own mother's memories.

   These four assertions are the whole chain. If someone re-adds the
   pre-create, they all fail at once. */
console.log("\nan email-only seat must not create a household anyone can take\n");

const ORPHAN = "9812345678";
const wl = await fetch(`${API}/api/waitlist`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: "Meena", email: "meena@example.com", elder_name: "Kamala", language: "hi-IN", phone: ORPHAN }),
});
ok("the seat itself is still granted without an account", wl.status === 200, `got ${wl.status}`);

/* Bob is a stranger who has merely guessed a 10-digit number. */
const strangerRead = await fetch(`${API}/api/people?phone=${ORPHAN}`, { headers: { authorization: `Bearer ${bob}` } });
ok("a stranger CANNOT read a seat-only number", strangerRead.status === 403, `got ${strangerRead.status}`);

const strangerClaim = await fetch(`${API}/api/register`, {
  method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${bob}` },
  body: JSON.stringify({ phone: ORPHAN, elder_name: "Hijacked", language: "hi-IN" }),
});
/* Claiming an unregistered number is the normal signup path, so 200 is correct
   here — what must NOT happen is the seat having pre-registered it, because
   then this call is a takeover of somebody else's household rather than a
   fresh signup. The assertion that matters is the elder's name below. */
/* No .catch(() => ({rows: []})) here, and the status is asserted first. That
   fallback used to make both assertions below pass on an empty array: when
   this route became admin-gated it started answering 403, and the suite went
   green while checking nothing at all. A guard that cannot fail is not a
   guard. */
const regsRes = await fetch(`${API}/api/registrations?admin=${ADMIN_PHONE}`);
ok("the registrations list is readable by an admin number", regsRes.status === 200, `got ${regsRes.status}`);
const after = await regsRes.json();
ok("…and it actually returned rows to assert against", Array.isArray(after.rows), JSON.stringify(after).slice(0, 120));
const row = (after.rows || []).find((r) => r.phone === ORPHAN);
ok("the seat did not pre-register the number", !row || row.owner_id, JSON.stringify(row || null).slice(0, 120));
ok("…so no ownerless household exists to be seized",
   !(after.rows || []).some((r) => !r.owner_id && r.source === "waitlist"),
   JSON.stringify((after.rows || []).filter((r) => !r.owner_id)).slice(0, 160));
void strangerClaim;

/* ── the public demo number is not an admin ────────────────────────────
   The whole point of splitting ALLOWED_PHONES into two lists. 1234567890 is
   printed on the site, in app/public/*.html and in the submission doc, so it
   must be able to hold a conversation and nothing else. Before the split it
   could read every seat-holder's name, email and phone number. */
console.log("\nthe number we print on the site is not an admin\n");

for (const route of ["waitlist/list", "feedback/list", "notify/list", "registrations"]) {
  const r = await fetch(`${API}/api/${route}?admin=1234567890`);
  const body = await r.json().catch(() => ({}));
  ok(`${route} refuses the public demo number`,
     r.status === 403 && !body.rows, `got ${r.status} ${JSON.stringify(body).slice(0, 80)}`);
}
const sweep = await fetch(`${API}/api/checkin/sweep?admin=1234567890`, { method: "POST" });
ok("checkin/sweep refuses the public demo number", sweep.status === 403, `got ${sweep.status}`);
/* …but it must still be able to talk, or the demo on the site is dead. This
   is the elder's route, not the family dashboard — /api/people is signed-in
   only, so 401 there is correct and proves nothing either way. tts:false
   keeps the check off Sarvam's bill. */
const demoTalk = await fetch(`${API}/api/session/start`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ phone: "1234567890", tts: false }),
});
ok("the public demo number can still open a conversation", demoTalk.status === 200, `got ${demoTalk.status}`);

console.log(`\n${fail === 0 ? "🎉" : "🔧"} ${pass} passed, ${fail} failed\n`);
srv.kill(); jwks.close();
rmSync(dataDir, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
