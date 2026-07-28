/* ------------------------------------------------------------------
   Transactional email, through Resend.

   Zero dependencies, like the rest of this backend: Resend is a plain
   JSON POST. No SDK, no queue, no retry daemon.

   Two rules this module exists to enforce:

   1. Email is never load-bearing. Every send is fire-and-forget and every
      failure is swallowed after a console line. A family who claimed seat
      #12 has seat #12 whether or not Resend was reachable — the seat is
      the promise, the email is only the receipt. So callers never await
      this, and a missing RESEND_API_KEY is a no-op, not an error.

   2. The mail has to look like the product. Elders' families get exactly
      one email from us before a human ever speaks to them; a bare
      sans-serif "You have been added to the waitlist" would undo the
      page they just came from. The templates below are built from the
      same tokens as the site (see landing-page/src/index.css).

   Email HTML is not web HTML. Tables, not flex. Inline styles, not
   classes. No @font-face — Gmail strips it — so the display serif falls
   back to Georgia, which is the closest thing every client already has.
   ------------------------------------------------------------------ */

const RESEND = "https://api.resend.com/emails";

/* All four read process.env at CALL time, never at module load — the same
   pattern as dodo.js and clerk.js, and not a style choice.
   server.js requires this module before it parses app/.env, so a top-level
   `const FROM = process.env.EMAIL_FROM || …` captured the fallback every time
   locally: mail went out from the sandbox sender instead of the verified
   domain, and REPLY_TO was null, which silently disabled the feedback alert
   altogether. Production hid it, because Railway injects variables into the
   process before Node starts. */

/* Resend's sandbox sender works with no domain verified, but it can only
   deliver to the account owner's own address. Set EMAIL_FROM to a verified
   domain before pointing this at real families. */
const from = () => process.env.EMAIL_FROM || "Yaadein <onboarding@resend.dev>";
const replyTo = () => process.env.EMAIL_REPLY_TO || null;
const site = () =>
  process.env.PUBLIC_URL || "https://sarvam-buildathon-production.up.railway.app";

const configured = () => !!(process.env.RESEND_API_KEY || "").trim();

/* ── the tokens, as email-safe literals ───────────────────────────── */

const C = {
  ink: "#1e2033",
  body: "#3a3f5c",
  faint: "#6b7092",
  page: "#f5f5f3",
  rule: "#dedee0",
  indigo: "#4250d5",
  indigoWash: "#f2f4ff",
  warm: "#c08827",
  warmWash: "#f6efe6",
  warmRule: "#e6d3ba",
  warmInk: "#3d2b1a",
  green: "#83c040",
};

const SERIF = "'Instrument Serif', Georgia, 'Times New Roman', serif";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/* ── the shell every email shares ─────────────────────────────────── */

/** An eyebrow: uppercase mono with a green dot, exactly as on the site. */
const eyebrow = (text) => `
  <p style="margin:0 0 18px;font-family:${MONO};font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:${C.faint};">
    <span style="color:${C.green};">&bull;</span>&nbsp; ${esc(text)}
  </p>`;

/** A pill button. Tables, because Outlook does not round a padded <a>. */
const button = (href, label) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0;">
    <tr><td bgcolor="${C.ink}" style="border-radius:999px;">
      <a href="${esc(href)}" style="display:inline-block;padding:13px 26px;font-family:${SANS};font-size:15px;font-weight:500;color:#ffffff;text-decoration:none;border-radius:999px;">
        ${esc(label)}
      </a>
    </td></tr>
  </table>`;

/**
 * Wraps body HTML in the branded frame: dark ticker band, white card on
 * warm grey, hairline-ruled footer.
 * @param {{ preheader: string, body: string }} parts
 */
function shell({ preheader, body }) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>Yaadein</title>
</head>
<body style="margin:0;padding:0;background:${C.page};">
<!-- the line clients show next to the subject; hidden in the mail itself -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page};">
  <tr><td align="center" style="padding:0 0 40px;">

    <!-- the ticker band, as on the site -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.ink};">
      <tr><td align="center" style="padding:11px 20px;font-family:${MONO};font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.62);">
        Yaadein &nbsp;&middot;&nbsp; A voice companion for elders living with memory loss &nbsp;&middot;&nbsp; Built on Sarvam
      </td></tr>
    </table>

    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">

      <!-- wordmark -->
      <tr><td style="padding:34px 8px 20px;font-family:${SERIF};font-size:24px;color:${C.ink};">
        <span style="font-size:21px;">&#2351;&#2366;&#2342;&#2375;&#2306;</span>
        &nbsp;<span style="color:${C.rule};">|</span>&nbsp;
        Yaadein
      </td></tr>

      <!-- the card -->
      <tr><td style="background:#ffffff;border:1px solid ${C.rule};border-radius:24px;padding:34px 34px 36px;">
        ${body}
      </td></tr>

      <!-- footer -->
      <tr><td style="padding:22px 8px 0;border-top:0;">
        <p style="margin:0 0 8px;font-family:${SANS};font-size:12.5px;line-height:1.6;color:${C.faint};">
          You&rsquo;re getting this because you asked us to keep you posted about Yaadein.
          Reply to this email and a person reads it &mdash; there is no ticket queue.
        </p>
        <p style="margin:0;font-family:${MONO};font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:#9095ad;">
          Yaadein &middot; Made in India &middot; Every model in it is Sarvam&rsquo;s
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

/* ── template: a waitlist seat is held ────────────────────────────── */

/**
 * @param {{ name?: string, elder_name?: string, seat: number, tier: string,
 *           seats: number, free_months: number, founding: number, already?: boolean }} d
 */
function seatEmail(d) {
  const founding = d.tier === "founding";
  const first = (d.name || "").trim().split(/\s+/)[0];
  const them = (d.elder_name || "").trim();

  /* Addressing the elder by name is the whole difference between a
     mailing-list receipt and a note about their mother. */
  const opener = them
    ? `Seat #${d.seat} is held, and ${esc(them)}&rsquo;s name is on it.`
    : `Seat #${d.seat} is held.`;

  const body = `
    ${eyebrow(d.already ? "You already had a seat" : "Your seat is confirmed")}

    <p style="margin:0 0 4px;font-family:${SANS};font-size:15px;color:${C.body};">
      ${first ? `${esc(first)},` : "Hello,"}
    </p>

    <h1 style="margin:0 0 18px;font-family:${SERIF};font-size:34px;line-height:1.15;font-weight:400;color:${C.ink};">
      ${opener}
    </h1>

    <!-- the seat number, given the weight it has on the page -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
           style="background:${founding ? C.warmWash : C.indigoWash};border:1px solid ${founding ? C.warmRule : "#d5e2ff"};border-radius:18px;margin:0 0 22px;">
      <tr><td style="padding:20px 22px;">
        <span style="font-family:${SERIF};font-size:46px;line-height:1;color:${C.ink};">#${d.seat}</span>
        <span style="font-family:${SANS};font-size:14px;color:${C.faint};">&nbsp; of ${d.seats}</span>
        <div style="margin-top:8px;font-family:${MONO};font-size:9.5px;letter-spacing:0.14em;text-transform:uppercase;color:${founding ? C.warmInk : C.indigo};">
          ${founding ? `Founding family &middot; free for good` : `Free for ${d.free_months} months`}
        </div>
      </td></tr>
    </table>

    <p style="margin:0 0 14px;font-family:${SANS};font-size:15px;line-height:1.65;color:${C.body};">
      ${
        founding
          ? `You&rsquo;re one of the first ${d.founding}. Yaadein stays free for you &mdash; not for
             ${d.free_months} months, for good. We&rsquo;d rather have ${d.founding} families who tell us
             the truth than ${d.founding} invoices, so all we&rsquo;ll ask for is honest feedback.`
          : `Nothing to pay for ${d.free_months} months, and no card was taken &mdash; there is nothing
             on file to charge. When the ${d.free_months} months are up we&rsquo;ll ask you, in writing,
             before a single rupee moves.`
      }
    </p>

    <p style="margin:0 0 6px;font-family:${SANS};font-size:15px;line-height:1.65;color:${C.body};">
      <strong style="color:${C.ink};">What happens next.</strong>
      We&rsquo;ll write to you to set the phone up &mdash; it takes about five minutes and there is
      nothing to install. ${them ? `${esc(them)} never signs in and never has to remember anything;` : `They never sign in and never have to remember anything;`}
      they tap one circle and talk.
    </p>

    <p style="margin:14px 0 0;font-family:${SANS};font-size:15px;line-height:1.65;color:${C.body};">
      You don&rsquo;t have to wait for us, though. Yaadein is live right now:
    </p>

    ${button(`${site()}/#/try`, "Hear it talk →")}

    <p style="margin:22px 0 0;padding-top:20px;border-top:1px solid ${C.rule};font-family:${SANS};font-size:13px;line-height:1.6;color:${C.faint};">
      One thing worth knowing before you try it: Yaadein never tests anyone. If ${them ? esc(them) : "they"}
      can&rsquo;t recall something, it doesn&rsquo;t correct them &mdash; it moves the conversation somewhere
      warmer and quietly notes it for you. That&rsquo;s the part we care most about getting right.
    </p>`;

  return {
    subject: founding
      ? `You're a Founding Family — seat #${d.seat}`
      : `Seat #${d.seat} of ${d.seats} is yours`,
    html: shell({
      preheader: founding
        ? `Yaadein stays free for you, for good. Here's what happens next.`
        : `Free for ${d.free_months} months, no card taken. Here's what happens next.`,
      body,
    }),
    text: [
      `${first ? first + "," : "Hello,"}`,
      "",
      them ? `Seat #${d.seat} is held, and ${them}'s name is on it.` : `Seat #${d.seat} of ${d.seats} is held.`,
      "",
      founding
        ? `You're one of the first ${d.founding} families — Yaadein stays free for you for good. All we'll ask for is honest feedback.`
        : `Nothing to pay for ${d.free_months} months, and no card was taken. We'll ask you before a single rupee moves.`,
      "",
      `Next: we'll write to you to set the phone up. It takes five minutes and there's nothing to install.`,
      "",
      `You can hear Yaadein talk right now: ${site()}/#/try`,
      "",
      `Yaadein never tests anyone. If they can't recall something it doesn't correct them — it moves somewhere warmer and quietly notes it for you.`,
    ].join("\n"),
  };
}

/* ── template: tell me when the app is out ────────────────────────── */

/** @param {{ platform?: string }} d */
function appEmail(d) {
  const plat =
    d.platform === "ios" ? "iPhone" : d.platform === "android" ? "Android" : "your phone";

  const body = `
    ${eyebrow("You're on the list")}

    <h1 style="margin:0 0 18px;font-family:${SERIF};font-size:32px;line-height:1.15;font-weight:400;color:${C.ink};">
      We&rsquo;ll tell you the day Yaadein lands on ${esc(plat)}.
    </h1>

    <p style="margin:0 0 14px;font-family:${SANS};font-size:15px;line-height:1.65;color:${C.body};">
      One email, when the app is actually downloadable. Not a countdown, not a newsletter.
    </p>

    <p style="margin:0 0 14px;font-family:${SANS};font-size:15px;line-height:1.65;color:${C.body};">
      <strong style="color:${C.ink};">You don&rsquo;t need the app to start.</strong>
      Everything Yaadein does works in the browser today &mdash; which is deliberate. An elder
      shouldn&rsquo;t have to install anything, find an icon, or stay signed in. A family sends
      one link, and it opens straight into the conversation.
    </p>

    ${button(`${site()}/#/try`, "Try it in the browser →")}

    <p style="margin:24px 0 0;padding-top:20px;border-top:1px solid ${C.rule};font-family:${SANS};font-size:13px;line-height:1.6;color:${C.faint};">
      If you&rsquo;re setting Yaadein up for a parent, the ${esc("first fifty")} cohort is still open &mdash;
      three months free, and the first ten families never pay.
      <a href="${site()}/#/waitlist" style="color:${C.indigo};text-decoration:underline;">Claim a seat</a>.
    </p>`;

  return {
    subject: `We'll tell you when Yaadein is on ${plat}`,
    html: shell({ preheader: `One email, when the app is actually downloadable.`, body }),
    text: [
      `We'll tell you the day Yaadein lands on ${plat}.`,
      "",
      `One email, when the app is actually downloadable. Not a countdown, not a newsletter.`,
      "",
      `You don't need the app to start — everything works in the browser today: ${site()}/#/try`,
      "",
      `Setting Yaadein up for a parent? The first-fifty cohort is still open — three months free, first ten never pay: ${site()}/#/waitlist`,
    ].join("\n"),
  };
}

/* ── sending ──────────────────────────────────────────────────────── */

/**
 * Hands one message to Resend. Never throws and never rejects: callers are
 * inside a request whose important work — the seat — is already committed.
 *
 * Worth awaiting anyway, even though the seat does not depend on it: the
 * return value is what the page uses to decide whether to say "check your
 * email", and that claim is only worth making if Resend actually took the
 * message. Awaiting a rejected send is how we found that out — the sandbox
 * sender 403s every recipient except the account owner, and the page was
 * cheerfully promising an inbox that had been refused.
 *
 * @returns {Promise<boolean>} whether Resend accepted it
 */
async function send(to, { subject, html, text }) {
  if (!configured()) {
    console.log(`[email] skipped "${subject}" → ${to} (no RESEND_API_KEY)`);
    return false;
  }
  try {
    const r = await fetch(RESEND, {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: from(),
        to: [to],
        subject,
        html,
        text,
        ...(replyTo() ? { reply_to: replyTo() } : {}),
      }),
      /* Resend answers in well under a second. The ceiling is low because a
         family is waiting on this response: if Resend is having a bad day they
         get their seat and "we'll be in touch" rather than a hung button. */
      signal: AbortSignal.timeout(6_000),
    });
    if (!r.ok) {
      console.warn(`[email] resend ${r.status} for ${to}: ${(await r.text()).slice(0, 240)}`);
      return false;
    }
    console.log(`[email] sent "${subject}" → ${to}`);
    return true;
  } catch (e) {
    console.warn(`[email] failed for ${to}: ${e.message}`);
    return false;
  }
}

module.exports = {
  configured,
  /** Seat confirmation. Fire-and-forget. */
  sendSeat: (to, d) => send(to, seatEmail(d)),
  /** Mobile-app notify confirmation. Fire-and-forget. */
  sendAppNotify: (to, d) => send(to, appEmail(d)),
  /* Feedback deliberately sends NOTHING. It is stored and read from the table
     instead — Resend's free tier is 100 messages a day, and spending it on
     alerts about rows we can query is how a seat confirmation ends up
     undelivered on the day it matters. See /api/feedback in server.js. */

  /* exported for scripts/email-preview.mjs, which writes them to disk so the
     templates can be eyeballed without sending anything */
  seatEmail,
  appEmail,
};
