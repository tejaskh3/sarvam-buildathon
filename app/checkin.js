// Check-in engine.
//
// The family sets a cadence — "she should be talking to Yaadein once a day" —
// and this watches whether it actually happens. The alert fires on ABSENCE,
// which is the point: a daughter in Bangalore cannot see that her mother in
// Nagpur has said nothing for two days. Every other signal in Yaadein comes
// from a conversation; this one comes from the lack of it.
//
// Dialling out is deliberately a separate, swappable step (`setDialer`).
// Sarvam's Samvaad platform can place a call, so can Exotel and Twilio, and
// each wants different credentials. So the engine is useful with no phone line
// at all — it alerts the family — and gains calling the moment a dialer is
// registered. Nothing here knows which provider won.

const db = require("./db");

let dialer = null; // async ({ personId, name, phone, hoursQuiet }) => { ok, detail }

/** Register the outbound-call provider. Called once at boot, if configured. */
function setDialer(fn) {
  dialer = typeof fn === "function" ? fn : null;
}
function dialerReady() {
  return typeof dialer === "function";
}

/* IST, the same way server.js does it: shift the epoch and read UTC fields.
   Elders keep Indian hours; the server keeps UTC. */
function istHour() {
  return new Date(Date.now() + 5.5 * 3600 * 1000).getUTCHours();
}

/** SQLite writes `datetime('now')` as UTC "YYYY-MM-DD HH:MM:SS" with no zone. */
function hoursSince(sqliteTs) {
  if (!sqliteTs) return Infinity;
  const t = Date.parse(String(sqliteTs).replace(" ", "T") + "Z");
  return Number.isFinite(t) ? (Date.now() - t) / 3600000 : Infinity;
}

/**
 * Is `hour` inside the family's do-not-disturb window?
 * The window normally wraps past midnight (21 → 8), so a naive `>= from && <
 * to` would be false all night — exactly backwards. Both directions handled.
 */
function inQuietHours(hour, from, to) {
  const f = Number(from), t = Number(to);
  if (!Number.isFinite(f) || !Number.isFinite(t) || f === t) return false; // no window
  return f < t ? hour >= f && hour < t : hour >= f || hour < t;
}

/**
 * One pass over every active schedule. Safe to call as often as you like —
 * `last_alert_at` is what stops a week of silence from alerting on every sweep.
 * Returns a summary so the tests (and the admin endpoint) can assert on it.
 */
async function sweep({ hour = istHour() } = {}) {
  const out = { checked: 0, alerted: 0, dialled: 0, quiet_hours: 0, too_soon: 0, within_cadence: 0 };

  for (const c of db.activeCheckins()) {
    out.checked++;
    const quiet = Number(c.hours_quiet || 0);

    if (quiet < c.every_hours) {
      out.within_cadence++;
      continue;
    }

    // One alert per cadence window, not one per sweep. Without this a family
    // whose parent is away for a week would get an alert every ten minutes.
    if (hoursSince(c.last_alert_at) < c.every_hours) {
      out.too_soon++;
      continue;
    }

    // Never ring an elder's phone at 3am. The alert waits for daylight —
    // it is not urgent enough to be worth frightening someone over.
    if (inQuietHours(hour, c.quiet_from, c.quiet_to)) {
      out.quiet_hours++;
      continue;
    }

    const h = Math.round(quiet);
    db.addCheckinEvent(
      c.person_id,
      "missed",
      `${c.name} hasn't talked to Yaadein for about ${h} ${h === 1 ? "hour" : "hours"}.`,
      quiet
    );
    db.markCheckinAlerted(c.person_id);
    out.alerted++;
    console.log(`[checkin] ${c.name} quiet ${h}h (cadence ${c.every_hours}h) → family alerted`);

    if (dialer && c.phone) {
      try {
        const r = await dialer({ personId: c.person_id, name: c.name, phone: c.phone, hoursQuiet: quiet });
        db.addCheckinEvent(c.person_id, r?.ok ? "dialled" : "dial_failed", r?.detail || null, quiet);
        if (r?.ok) out.dialled++;
      } catch (e) {
        // a provider outage must never take the alert down with it
        db.addCheckinEvent(c.person_id, "dial_failed", e.message, quiet);
        console.warn(`[checkin] dial failed for ${c.name}: ${e.message}`);
      }
    }
  }
  return out;
}

/**
 * Called when an elder starts talking again. Closes the loop so the family sees
 * "she's talking again" rather than a stale worry they have to work out
 * themselves. Silent unless there was an unacknowledged alert to answer.
 */
function noteConversation(personId) {
  const open = db.checkinEventsFor(personId, 5).find((e) => e.kind === "missed" && !e.acknowledged);
  if (!open) return false;
  db.addCheckinEvent(personId, "resumed", "Talked to Yaadein again.", 0);
  db.ackCheckinEvents(personId);
  return true;
}

/** Everything the dashboard needs about one elder's check-in state. */
function status(personId) {
  const c = db.getCheckin(personId);
  const quiet = db.hoursQuiet(personId);
  const overdue = !!c.active && quiet >= c.every_hours;
  return {
    schedule: {
      every_hours: c.every_hours,
      quiet_from: c.quiet_from,
      quiet_to: c.quiet_to,
      active: !!c.active,
    },
    hours_quiet: Math.round(quiet * 10) / 10,
    overdue,
    // negative would read as a countdown that's already run out; clamp to 0
    hours_until_due: overdue ? 0 : Math.round((c.every_hours - quiet) * 10) / 10,
    dialing_enabled: dialerReady(),
    events: db.checkinEventsFor(personId, 20),
  };
}

module.exports = { setDialer, dialerReady, sweep, status, noteConversation, inQuietHours, hoursSince, istHour };
