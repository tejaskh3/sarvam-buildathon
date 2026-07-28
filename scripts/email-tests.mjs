/* Tests for the transactional emails and the notify list.

   Email is the one surface with no way to check your work after the fact: it
   leaves the building and lands in somebody's inbox looking however it looks.
   So the things that would embarrass us there are asserted here — an unfilled
   template hole, a greeting addressed to nobody, a relative link that means
   nothing outside a browser tab.

   Nothing here touches the network. */
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
const email = require_("../app/email.js");

let pass = 0,
  fail = 0;
const ok = (name, cond, detail = "") => {
  console.log(`${cond ? "✅" : "❌"} ${name}`);
  if (!cond && detail) console.log(`     ${detail}`);
  cond ? pass++ : fail++;
};

const SEAT = { seats: 50, free_months: 3, founding: 10 };

/* ── the holes that would ship ─────────────────────────────────────── */

console.log("\nno template holes\n");

/* The third element is what this KIND of mail owes its reader. Both of these go
   OUT to a family, so both must carry a way back into the product — an email
   about a product with no link to it is a dead end. */
const every = [
  ["seat, founding", email.seatEmail({ name: "Tejas Gupta", elder_name: "Kamala", seat: 4, tier: "founding", ...SEAT }), { minText: 200, needsLink: true }],
  ["seat, regular", email.seatEmail({ name: "Priya", elder_name: "Appa", seat: 23, tier: "seat", ...SEAT }), { minText: 200, needsLink: true }],
  ["seat, no names at all", email.seatEmail({ seat: 37, tier: "seat", ...SEAT }), { minText: 200, needsLink: true }],
  ["app, iOS", email.appEmail({ platform: "ios" }), { minText: 150, needsLink: true }],
  ["app, no platform", email.appEmail({}), { minText: 150, needsLink: true }],
];

for (const [label, m, want] of every) {
  const all = `${m.subject}\n${m.html}\n${m.text}`;
  ok(`${label} — no undefined/null/NaN leaked in`, !/undefined|null|NaN/.test(all),
     (all.match(/.{0,40}(undefined|null|NaN).{0,40}/) || [])[0]);
  ok(`${label} — has a subject, html and a plain-text part`,
     !!m.subject && m.html.length > 500 && m.text.length >= want.minText,
     `text ${m.text.length} chars, wanted ≥ ${want.minText}`);
  /* A relative href is meaningless in an inbox: there is no page it is
     relative TO. Every link that exists has to be absolute — and the outbound
     mails must actually have one, or they are a dead end. */
  const hrefs = [...m.html.matchAll(/href="([^"]+)"/g)].map((x) => x[1]);
  ok(`${label} — links absolute, ${want.needsLink ? "and at least one" : "none expected"} (${hrefs.length})`,
     hrefs.every((h) => /^https?:\/\//.test(h)) && (want.needsLink ? hrefs.length > 0 : true),
     hrefs.filter((h) => !/^https?:\/\//.test(h)).join(", "));
  ok(`${label} — one <html>, closed`,
     (m.html.match(/<html/g) || []).length === 1 && m.html.trim().endsWith("</html>"));
}

/* ── the thin case: nobody told us any names ───────────────────────── */

console.log("\nwriting to someone we know nothing about\n");

const bare = email.seatEmail({ seat: 37, tier: "seat", ...SEAT });
ok("no greeting addressed to nobody", !/Hello ,|>\s*,/.test(bare.html), bare.html.match(/.{0,30},.{0,20}/)?.[0]);
ok("no dangling possessive where the elder's name would go", !/&rsquo;s name is on it/.test(bare.html));
ok("falls back to a plain 'Hello,'", bare.text.startsWith("Hello,"));
ok("still says which seat", bare.text.includes("Seat #37 of 50"));

/* ── founding vs regular: two different promises ───────────────────── */

console.log("\nthe two tiers say different things\n");

const founding = email.seatEmail({ name: "A", elder_name: "Kamala", seat: 4, tier: "founding", ...SEAT });
const regular = email.seatEmail({ name: "B", elder_name: "Appa", seat: 23, tier: "seat", ...SEAT });

ok("founding subject names the tier", /Founding Family/.test(founding.subject), founding.subject);
ok("regular subject names the seat", /Seat #23 of 50/.test(regular.subject), regular.subject);
ok("founding promises free for good", /free for you/.test(founding.text) && /for good/.test(founding.text));
/* The one that would cost us money if it broke: a paying family must never be
   told they are free forever, and a founding family must never be quoted a
   date they start paying. */
ok("founding is NOT told about the 3 months running out", !/months are up/.test(founding.text));
ok("regular IS told nothing charges without asking", /before a single rupee moves/.test(regular.text));
ok("neither mentions a card we never took", !/card/i.test(founding.text.replace(/no card was taken/i, "")));

ok("the elder is addressed by name when we have it", /Kamala/.test(founding.html));
ok("the family's first name only, not the full name",
   email.seatEmail({ name: "Tejas Gupta", seat: 1, tier: "seat", ...SEAT }).text.startsWith("Tejas,"));

/* ── escaping: a name is untrusted input ───────────────────────────── */

console.log("\nnames are untrusted input\n");

const nasty = email.seatEmail({
  name: '<script>alert(1)</script>', elder_name: 'A"><b>B', seat: 5, tier: "seat", ...SEAT,
});
ok("no raw <script> survives into the html", !/<script>/.test(nasty.html));
ok("a quote in a name cannot break out of an attribute", !/<b>/.test(nasty.html));

/* ── sending is gated, and never throws ───────────────────────────── */

console.log("\nsending without a key\n");

const savedKey = process.env.RESEND_API_KEY;
delete process.env.RESEND_API_KEY;
ok("configured() is false with no key", email.configured() === false);
const sent = await email.sendSeat("nobody@example.com", { seat: 1, tier: "seat", ...SEAT });
ok("sendSeat resolves false instead of throwing", sent === false);
if (savedKey) process.env.RESEND_API_KEY = savedKey;

/* ── feedback sends nothing ───────────────────────────────────────── */

console.log("\nfeedback is stored, never emailed\n");

/* Guarding a decision, not an implementation: feedback goes in the table and is
   read with /api/feedback/list. Resend's free tier is 100 messages a day, and
   spending it on alerts about rows we can query is how a seat confirmation ends
   up undelivered on the day it matters. If someone re-adds a feedback email,
   this fails and they have to argue with the reason first. */
ok("no feedback template is exported", email.feedbackEmail === undefined);
ok("no feedback sender is exported", email.sendFeedbackAlert === undefined);
const senders = Object.keys(email).filter((k) => k.startsWith("send")).sort().join(",");
ok("the only senders are the two family-facing ones", senders === "sendAppNotify,sendSeat", senders);

/* ── config is read at send time, not at import ───────────────────── */

console.log("\nconfig is read late, not at import\n");

/* The regression this guards actually shipped: server.js requires this module
   BEFORE it parses app/.env, so a top-level `const FROM = process.env.EMAIL_FROM
   || …` captured the fallback every time — mail went out from the sandbox sender
   instead of the verified domain, and every link in it pointed at the
   railway.app URL. Production hid it, because Railway injects variables before
   Node starts. Reading env inside the accessors is what makes load order
   irrelevant, and this is the only test that can tell. */
delete require_.cache[require_.resolve("../app/email.js")];
const savedUrl = process.env.PUBLIC_URL;
delete process.env.PUBLIC_URL;
const late = require_("../app/email.js");              // imported with it unset…
process.env.PUBLIC_URL = "https://set-after-import.example";  // …set afterwards
const lateMail = late.seatEmail({ name: "A", seat: 1, tier: "seat", ...SEAT });
ok("a PUBLIC_URL set after import still reaches the links",
   lateMail.html.includes("https://set-after-import.example"),
   (lateMail.html.match(/href="([^"]+)"/) || [])[1]);
if (savedUrl) process.env.PUBLIC_URL = savedUrl;
else delete process.env.PUBLIC_URL;
/* ── the notify list ──────────────────────────────────────────────── */

console.log("\nthe notify list\n");

process.env.YAADEIN_DATA_DIR = new URL("../.test-notify", import.meta.url).pathname;
const { rmSync, mkdirSync } = await import("node:fs");
rmSync(process.env.YAADEIN_DATA_DIR, { recursive: true, force: true });
mkdirSync(process.env.YAADEIN_DATA_DIR, { recursive: true });
const db = require_("../app/db.js");

const first = db.joinNotify({ email: "Someone@Example.com ", platform: "ios" });
ok("a new address is not 'already'", first.already === false);
ok("stored lower-cased", db.notifyAll()[0].email === "someone@example.com");

const again = db.joinNotify({ email: "someone@example.com", platform: "android" });
ok("asking twice is idempotent, not an error", again.already === true);
ok("one row, not two", db.notifyCount() === 1);
/* They may have changed phones between asking and shipping — the later answer
   is the one that decides which store we tell them about. */
ok("the platform is updated to the latest answer", db.notifyAll()[0].platform === "android");

db.joinNotify({ email: "other@example.com" });
ok("a second address counts separately", db.notifyCount() === 2);
ok("platform is optional", db.notifyAll().some((r) => r.platform === null));

rmSync(process.env.YAADEIN_DATA_DIR, { recursive: true, force: true });

console.log(`\n${fail === 0 ? "🎉" : "🔧"} ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
