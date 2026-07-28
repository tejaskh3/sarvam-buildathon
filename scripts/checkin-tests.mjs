/* Check-in engine tests.

   Runs against a throwaway SQLite file so it can fabricate the one thing the
   feature is about and nobody can wait for in a test: time passing. Sessions
   are backdated directly, then the sweep is asked what it makes of them. */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "yaadein-checkin-"));
process.env.YAADEIN_DATA_DIR = dir;
process.env.SARVAM_API_KEY = "test-key-not-used"; // db.js/checkin.js never call out

const { createRequire } = await import("node:module");
const require = createRequire(new URL("../app/", import.meta.url));
const db = require("./db");
const checkin = require("./checkin");
const raw = require("node:sqlite");

let pass = 0,
  fail = 0;
const ok = (name, cond, detail = "") => {
  console.log(`${cond ? "✅" : "❌"} ${name}${detail && !cond ? " — " + detail : ""}`);
  cond ? pass++ : fail++;
};

/* ── pure logic first: the quiet-hours window ── */
console.log("\nquiet hours\n");
// The wrap past midnight is the normal configuration and the easy thing to get
// backwards, so it gets tested from both sides.
ok("21→8 window: 23:00 is quiet", checkin.inQuietHours(23, 21, 8));
ok("21→8 window: 03:00 is quiet", checkin.inQuietHours(3, 21, 8));
ok("21→8 window: 10:00 is NOT quiet", !checkin.inQuietHours(10, 21, 8));
ok("21→8 window: 20:00 is NOT quiet", !checkin.inQuietHours(20, 21, 8));
ok("1→6 window (no wrap): 03:00 is quiet", checkin.inQuietHours(3, 1, 6));
ok("1→6 window (no wrap): 08:00 is NOT quiet", !checkin.inQuietHours(8, 1, 6));
ok("from === to means no quiet window at all", !checkin.inQuietHours(5, 0, 0));

/* ── the engine, against real rows ── */
console.log("\nsweep\n");

const { person } = db.findOrCreatePerson("Kamala", "9999900001");
db.setCheckin(person.id, { every_hours: 24, quiet_from: 21, quiet_to: 8, active: 1 });

// a brand-new household must not alert the moment it's switched on
let r = await checkin.sweep({ hour: 10 });
ok("a just-configured elder does not alert", r.alerted === 0 && r.within_cadence === 1, JSON.stringify(r));

// backdate a conversation to 40 hours ago — past a 24h cadence
const sdb = new raw.DatabaseSync(join(dir, "yaadein.db"));
const backdate = (hours) => {
  sdb.prepare("DELETE FROM sessions WHERE person_id = ?").run(person.id);
  sdb
    .prepare("INSERT INTO sessions (id, person_id, started_at) VALUES (?, ?, datetime('now', ?))")
    .run(`s-${hours}`, person.id, `-${hours} hours`);
};
backdate(40);

ok("hoursQuiet reads the backdated session", Math.round(db.hoursQuiet(person.id)) === 40, `got ${db.hoursQuiet(person.id)}`);

r = await checkin.sweep({ hour: 10 });
ok("40h quiet against a 24h cadence alerts the family", r.alerted === 1, JSON.stringify(r));

const events = db.checkinEventsFor(person.id);
ok("a 'missed' event is recorded", events[0]?.kind === "missed", JSON.stringify(events[0]));
ok("the event says how long it's been", /about 40 hours/.test(events[0]?.detail || ""), events[0]?.detail);

// the same silence must not alert again on the next sweep
r = await checkin.sweep({ hour: 10 });
ok("the same silence does not alert twice", r.alerted === 0 && r.too_soon === 1, JSON.stringify(r));

/* ── nobody's phone rings at 3am ── */
console.log("\nnight time\n");
const { person: p2 } = db.findOrCreatePerson("Raghav", "9999900002");
db.setCheckin(p2.id, { every_hours: 12, quiet_from: 21, quiet_to: 8, active: 1 });
sdb
  .prepare("INSERT INTO sessions (id, person_id, started_at) VALUES (?, ?, datetime('now', '-30 hours'))")
  .run("s-night", p2.id);

r = await checkin.sweep({ hour: 3 });
ok("overdue but 3am → held until morning", r.quiet_hours >= 1 && r.alerted === 0, JSON.stringify(r));
r = await checkin.sweep({ hour: 9 });
ok("same elder alerts once it's 9am", r.alerted === 1, JSON.stringify(r));

/* ── talking again closes the loop ── */
console.log("\nresolution\n");
ok("a missed alert is waiting", db.checkinEventsFor(person.id).some((e) => e.kind === "missed" && !e.acknowledged));
ok("noteConversation records the resolution", checkin.noteConversation(person.id) === true);
ok("a 'resumed' event is recorded", db.checkinEventsFor(person.id)[0]?.kind === "resumed");
ok("the old alert is acknowledged", !db.checkinEventsFor(person.id).some((e) => e.kind === "missed" && !e.acknowledged));
ok("nothing to close → no duplicate 'resumed'", checkin.noteConversation(person.id) === false);

/* ── the dialer is optional, and its failure must not break alerting ── */
console.log("\ndialer adapter\n");
ok("no dialer registered by default", checkin.dialerReady() === false);

const dialled = [];
checkin.setDialer(async ({ phone }) => {
  dialled.push(phone);
  return { ok: true, detail: "test provider" };
});
ok("registering a dialer flips the flag", checkin.dialerReady() === true);

const { person: p3 } = db.findOrCreatePerson("Shanti", "9999900003");
db.setCheckin(p3.id, { every_hours: 6, quiet_from: 21, quiet_to: 8, active: 1 });
sdb
  .prepare("INSERT INTO sessions (id, person_id, started_at) VALUES (?, ?, datetime('now', '-20 hours'))")
  .run("s-dial", p3.id);
r = await checkin.sweep({ hour: 11 });
ok("an overdue elder gets dialled", dialled.includes("9999900003"), JSON.stringify(dialled));
ok("the call is recorded as an event", db.checkinEventsFor(p3.id).some((e) => e.kind === "dialled"));

// a provider outage is the likeliest failure in production; the family alert
// must survive it
checkin.setDialer(async () => {
  throw new Error("provider down");
});
const { person: p4 } = db.findOrCreatePerson("Mohan", "9999900004");
db.setCheckin(p4.id, { every_hours: 6, quiet_from: 21, quiet_to: 8, active: 1 });
sdb
  .prepare("INSERT INTO sessions (id, person_id, started_at) VALUES (?, ?, datetime('now', '-20 hours'))")
  .run("s-fail", p4.id);
r = await checkin.sweep({ hour: 11 });
ok("a dialer that throws still alerts the family", r.alerted === 1, JSON.stringify(r));
ok("the failure is recorded, not swallowed", db.checkinEventsFor(p4.id).some((e) => e.kind === "dial_failed"));
checkin.setDialer(null);

/* ── switching it off means silence ── */
console.log("\noff switch\n");
db.setCheckin(person.id, { every_hours: 24, quiet_from: 21, quiet_to: 8, active: 0 });
const before = db.checkinEventsFor(person.id).length;
backdate(100);
await checkin.sweep({ hour: 12 });
ok("an inactive schedule never alerts", db.checkinEventsFor(person.id).length === before);

/* ── status(), which is what the dashboard renders ── */
console.log("\nstatus\n");
db.setCheckin(person.id, { every_hours: 24, quiet_from: 21, quiet_to: 8, active: 1 });
const st = checkin.status(person.id);
ok("status reports overdue", st.overdue === true, JSON.stringify(st.schedule));
ok("countdown is clamped at 0 when overdue", st.hours_until_due === 0, String(st.hours_until_due));
backdate(2);
const st2 = checkin.status(person.id);
ok("a recent talker is not overdue", st2.overdue === false, JSON.stringify(st2));
ok("countdown shows hours remaining", st2.hours_until_due > 21 && st2.hours_until_due <= 22, String(st2.hours_until_due));

/* ── the cadence bounds ── */
console.log("\nbounds\n");
ok("a 1-hour cadence is clamped up to 4h", db.setCheckin(person.id, { every_hours: 1 }).every_hours === 4);
ok("a 1-year cadence is clamped down to a week", db.setCheckin(person.id, { every_hours: 9000 }).every_hours === 168);

sdb.close();
rmSync(dir, { recursive: true, force: true });
console.log(`\n${fail === 0 ? "🎉" : "🔧"} ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
