#!/usr/bin/env node
// Dodo webhook test harness — no Dodo account required.
//
// `dodo wh trigger` produces genuine Dodo payloads offline, but sends them
// unsigned, so it can't exercise our signature check on its own. This script
// stands a signing proxy in between:
//
//     dodo wh trigger  ──unsigned──▶  proxy (signs)  ──signed──▶  /api/dodo/webhook
//
// So the bodies are always exactly what Dodo really sends, and the whole path
// — signature, idempotency, plan upgrade — runs for real.
//
// Usage:
//   node scripts/webhook-test.mjs                      # against localhost:3000
//   node scripts/webhook-test.mjs --api=https://…      # against prod
//   node scripts/webhook-test.mjs --phone=9876543210   # attribute to a family
//
// The server must be running with the SAME DODO_WEBHOOK_SECRET this script
// uses (defaults to a throwaway test secret — export DODO_WEBHOOK_SECRET to
// match a real deployment).

import crypto from "node:crypto";
import http from "node:http";
import { spawn } from "node:child_process";

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `=${d}`).split("=").slice(1).join("=");

const API = arg("api", "http://localhost:3000");
const PHONE = arg("phone", "");
const PROXY_PORT = Number(arg("port", "3201"));
const SECRET = process.env.DODO_WEBHOOK_SECRET || "whsec_" + Buffer.from("yaadein-local-test-secret").toString("base64");

// CLI trigger name → the `type` that actually appears in the body. They differ
// for payment.success, which is exactly the kind of thing this script exists
// to catch.
const EVENTS = [
  "payment.success",
  "payment.failed",
  "subscription.active",
  "subscription.cancelled",
  "subscription.expired",
];

const key = SECRET.startsWith("whsec_") ? Buffer.from(SECRET.slice(6), "base64") : Buffer.from(SECRET, "utf8");

function sign(id, ts, body) {
  return crypto.createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64");
}

/** Forward a captured payload to the real endpoint, correctly signed. */
async function forward(bodyStr, { id, tamper = false, replay = false } = {}) {
  const wid = id || `msg_${crypto.randomUUID()}`;
  const ts = Math.floor(Date.now() / 1000);
  const sig = sign(wid, ts, bodyStr);
  const r = await fetch(`${API}/api/dodo/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "webhook-id": wid,
      "webhook-timestamp": String(ts),
      "webhook-signature": "v1," + (tamper ? Buffer.from("x".repeat(32)).toString("base64") : sig),
    },
    body: bodyStr,
  });
  return { status: r.status, body: (await r.text()).slice(0, 120), wid, replay };
}

/** Inject our household number the way a real checkout link would. */
function tag(bodyStr) {
  if (!PHONE) return bodyStr;
  const e = JSON.parse(bodyStr);
  e.data = e.data || {};
  e.data.metadata = { ...(e.data.metadata || {}), phone: PHONE };
  return JSON.stringify(e);
}

const captured = [];
const proxy = http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    captured.push(Buffer.concat(chunks).toString());
    res.writeHead(200, { "content-type": "application/json" });
    res.end('{"ok":true}');
  });
});

const run = (event) =>
  new Promise((resolve) => {
    const p = spawn("dodo", ["wh", "trigger", event, `http://localhost:${PROXY_PORT}/`], { stdio: "ignore" });
    p.on("close", () => resolve());
    p.on("error", () => {
      console.error("\n  `dodo` CLI not found. Install it with:  npm i -g dodopayments-cli\n");
      process.exit(1);
    });
  });

const pad = (s, n) => String(s).padEnd(n);

proxy.listen(PROXY_PORT, async () => {
  console.log(`\n  target ${API}   secret ${SECRET.slice(0, 12)}…   phone ${PHONE || "(none — expect unattributed)"}\n`);

  let fails = 0;
  const check = (label, ok, detail) => {
    if (!ok) fails++;
    console.log(`  ${ok ? "✓" : "✗"} ${pad(label, 42)} ${detail}`);
  };

  for (const event of EVENTS) {
    captured.length = 0;
    await run(event);
    if (!captured.length) {
      check(event, false, "CLI produced no payload");
      continue;
    }
    const body = tag(captured[0]);
    const type = JSON.parse(body).type;
    const r = await forward(body);
    check(`${event} → type=${type}`, r.status === 200, `${r.status} ${r.body}`);

    // Dodo retries any non-2xx; the same webhook-id must not be counted twice.
    const again = await forward(body, { id: r.wid });
    check(`  replay of ${r.wid.slice(0, 12)}…`, again.body.includes("duplicate"), `${again.status} ${again.body}`);
  }

  // A forged signature must never reach the handler.
  const forged = await forward(tag(captured[0] || "{}"), { tamper: true });
  check("forged signature rejected", forged.status === 401, `${forged.status} ${forged.body}`);

  console.log(`\n  ${fails ? `${fails} check(s) FAILED` : "all checks passed"}\n`);
  proxy.close();
  process.exit(fails ? 1 : 0);
});
