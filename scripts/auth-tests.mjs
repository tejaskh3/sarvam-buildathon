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
const srv = spawn("node", ["--experimental-sqlite", "app/server.js"], {
  env: { ...process.env, PORT: "3111", CLERK_ISSUER: ISSUER, YAADEIN_DATA_DIR: dataDir },
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
const elderSession = await elder.json();
const realtimeSession = await fetch(`${API}/api/realtime/session`, {
  headers: { "x-session-id": elderSession.sessionId },
});
const realtimeBody = await realtimeSession.json();
ok(
  "the realtime worker can retrieve only its session opener",
  realtimeSession.status === 200 && !!realtimeBody.text && !!realtimeBody.language,
  `got ${realtimeSession.status}: ${JSON.stringify(realtimeBody).slice(0, 100)}`,
);
const unknownRealtime = await fetch(`${API}/api/realtime/session`, {
  headers: { "x-session-id": "not-a-real-session" },
});
ok("an unknown realtime session is refused", unknownRealtime.status === 400, `got ${unknownRealtime.status}`);

console.log(`\n${fail === 0 ? "🎉" : "🔧"} ${pass} passed, ${fail} failed\n`);
srv.kill(); jwks.close();
rmSync(dataDir, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
