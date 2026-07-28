/* The Sarvam adapter's policy, tested.

   This suite is the reason app/sarvam.js exists. The timeout and the retry
   were absent from all eight old call sites not because anyone decided
   against them but because there was nowhere to put them — and nowhere to
   assert them from either. Now there is one place, and these are the claims
   it makes.

   No network, no API key, no Sarvam. A stub http server stands in, which is
   the point: the adapter's seam is the same one a test crosses. */

import http from "node:http";
import { createRequire } from "node:module";

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`✅ ${name}`); }
  else { fail++; console.log(`❌ ${name}${extra ? ` — ${extra}` : ""}`); }
};
const section = (s) => console.log(`\n${s}\n`);

/* A stub Sarvam. `plan` is a list of responses to give, in order, so a test
   can say "fail with 429, then succeed" and count what actually arrived. */
function stubServer(plan) {
  const seen = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      const step = plan[Math.min(seen.length, plan.length - 1)];
      seen.push({ url: req.url, contentType: req.headers["content-type"], body });
      if (step.delayMs) await new Promise((r) => setTimeout(r, step.delayMs));
      if (res.writableEnded) return;
      const headers = { "content-type": "application/json", ...(step.headers || {}) };
      res.writeHead(step.status, headers);
      res.end(JSON.stringify(step.json ?? { ok: true }));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, seen, port: server.address().port }));
  });
}

async function withStub(plan, run) {
  const { server, seen, port } = await stubServer(plan);
  process.env.SARVAM_BASE_URL = `http://127.0.0.1:${port}`;
  process.env.SARVAM_API_KEY = "test-key";
  /* Required fresh each time so BASE picks up this stub's port. */
  const require = createRequire(import.meta.url);
  delete require.cache[require.resolve("../app/sarvam.js")];
  const sarvam = require("../app/sarvam.js");
  try {
    return await run(sarvam, seen);
  } finally {
    server.close();
  }
}

section("a fast failure is worth asking twice");

await withStub(
  [{ status: 429, json: { error: "rate limited" } }, { status: 200, json: { choices: [{ message: { content: " hello " } }] } }],
  async (sarvam, seen) => {
    const out = await sarvam.chat({ model: "m", messages: [], label: "Chat" });
    ok("429 is retried and the second answer is returned", out === "hello", `got ${JSON.stringify(out)}`);
    ok("exactly two requests reached the server", seen.length === 2, `saw ${seen.length}`);
  }
);

await withStub(
  [{ status: 503 }, { status: 200, json: { translated_text: "नमस्ते" } }],
  async (sarvam, seen) => {
    const out = await sarvam.translate({ input: "hi", source: "en-IN", target: "hi-IN" });
    ok("503 is retried", out === "नमस्ते", `got ${out}`);
    ok("and only once", seen.length === 2, `saw ${seen.length}`);
  }
);

await withStub([{ status: 429 }], async (sarvam, seen) => {
  let err = null;
  try { await sarvam.chat({ model: "m", messages: [], label: "Chat" }); } catch (e) { err = e; }
  ok("a persistent 429 eventually gives up", err !== null);
  ok("after exactly one retry, not more", seen.length === 2, `saw ${seen.length}`);
});

section("a slow failure is not");

await withStub([{ status: 200, delayMs: 400, json: {} }], async (sarvam, seen) => {
  let err = null;
  const t = Date.now();
  try {
    await sarvam.chat({ model: "m", messages: [], label: "Chat", timeoutMs: 120 });
  } catch (e) { err = e; }
  const took = Date.now() - t;
  ok("a hang raises SarvamTimeout", err && err.name === "SarvamTimeout", err && err.name);
  ok("the timeout is NOT retried — one hang, not two", seen.length === 1, `saw ${seen.length}`);
  ok("and it surfaces at roughly the budget, not double it", took < 300, `took ${took}ms`);
});

section("the error message is a contract, not a string");

await withStub([{ status: 429 }], async (sarvam) => {
  let msg = "";
  try { await sarvam.chat({ model: "m", messages: [], label: "Chat" }); } catch (e) { msg = e.message; }
  /* sarvamError() in server.js reads the status back out of this message to
     tell a family "a lot of families are talking right now". If the format
     drifts, that message silently becomes a raw error instead. */
  ok("a 429 message still matches what sarvamError() greps for", /\b429\b/.test(msg), msg);
});

await withStub([{ status: 402 }], async (sarvam) => {
  let msg = "";
  try { await sarvam.chat({ model: "m", messages: [], label: "Chat" }); } catch (e) { msg = e.message; }
  ok("a 402 message still matches the credits branch", /\b402\b/.test(msg), msg);
});

await withStub([{ status: 400, json: { error: "bad model" } }], async (sarvam, seen) => {
  let err = null;
  try { await sarvam.chat({ model: "m", messages: [], label: "Chat" }); } catch (e) { err = e; }
  ok("a 400 is our bug, so it is not retried", seen.length === 1, `saw ${seen.length}`);
  ok("and it carries the status", err && err.status === 400, err && String(err.status));
});

section("the shapes callers no longer have to know");

await withStub([{ status: 200, json: { choices: [{ message: { content: '{"a":1}' } }] } }], async (sarvam) => {
  const raw = await sarvam.chat({ model: "m", messages: [], json: true });
  ok("json:true returns the raw content for the caller to parse", raw === '{"a":1}', raw);
});

await withStub([{ status: 200, json: { audios: ["YmFzZTY0"] } }], async (sarvam) => {
  const b64 = await sarvam.tts({ text: "hi", model: "bulbul:v3", speaker: "simran", pace: 0.85, temperature: 0.4, language: "hi-IN" });
  ok("tts unwraps audios[0]", b64 === "YmFzZTY0", b64);
});

await withStub([{ status: 200, json: { transcript: "नमस्ते", language_code: "hi-IN" } }], async (sarvam, seen) => {
  const out = await sarvam.stt(Buffer.from("RIFF fake wav"), { model: "saaras:v3", mode: "codemix" });
  ok("stt unwraps transcript + language", out.transcript === "नमस्ते" && out.language === "hi-IN", JSON.stringify(out));
  /* FormData has to set its own content-type: it carries the multipart
     boundary, and overriding it makes the upload unparseable at the far end.
     Easy to break by "tidying" the header spread, so it is pinned here. */
  ok(
    "the multipart boundary survives — content-type was not overridden",
    /^multipart\/form-data; boundary=/.test(seen[0].contentType || ""),
    seen[0].contentType
  );
});

await withStub([{ status: 200, json: { transcript: "", language_code: null } }], async (sarvam) => {
  const out = await sarvam.stt(Buffer.from("x"), { model: "saaras:v3", mode: "codemix" });
  ok("silence is an empty transcript, never undefined", out.transcript === "" && out.language === null);
});

console.log(`\n${fail ? "❌" : "🎉"} ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
