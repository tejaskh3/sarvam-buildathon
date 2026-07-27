// Dodo Payments — webhook verification + plan mapping. Zero npm dependencies.
//
// Dodo follows the Standard Webhooks spec (standardwebhooks.com), which Svix
// popularised: three headers, and a signature over "id.timestamp.body".
// Verifying it ourselves is ~20 lines, so we don't take the dependency.
//
// Checkout itself needs no code — it's a hosted payment link. All the server
// does is listen for the "they paid" callback and move the family onto a plan.
//
// Reference: https://docs.dodopayments.com/developer-resources/webhooks

const crypto = require("crypto");

const SECRET = () => process.env.DODO_WEBHOOK_SECRET || null;
const TOLERANCE_S = 5 * 60; // reject replays older than this

/**
 * Verify a Standard Webhooks signature.
 * @param {object} headers  node's req.headers (lowercased already)
 * @param {Buffer|string} rawBody  the EXACT bytes received — never re-serialise
 *   a parsed object here, key order would change and the HMAC would not match
 * @returns {{ok: true} | {ok: false, reason: string}}
 */
function verifyWebhook(headers, rawBody) {
  const secret = SECRET();
  if (!secret) return { ok: false, reason: "not_configured" };

  const id = headers["webhook-id"];
  const ts = headers["webhook-timestamp"];
  const sigHeader = headers["webhook-signature"];
  if (!id || !ts || !sigHeader) return { ok: false, reason: "missing_headers" };

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(ts));
  if (!Number.isFinite(age) || age > TOLERANCE_S) return { ok: false, reason: "stale_timestamp" };

  // "whsec_<base64>" — the bytes after the prefix are the key, base64-encoded.
  // A secret without the prefix is used as raw utf8 (some dashboards show it that way).
  const key = secret.startsWith("whsec_")
    ? Buffer.from(secret.slice(6), "base64")
    : Buffer.from(secret, "utf8");

  const body = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody);
  const expected = crypto.createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64");

  // The header is a space-separated list of "<version>,<signature>" so a secret
  // can be rotated without downtime — any one match is enough.
  const found = String(sigHeader)
    .split(" ")
    .map((p) => p.split(",").pop())
    .some((s) => s && s.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));

  return found ? { ok: true } : { ok: false, reason: "bad_signature" };
}

// Which plan does an event put the family on? Anything not listed here is
// recorded but changes nothing — we never downgrade on a single failed charge,
// that's what dunning is for.
//
// These are the `type` values on the wire, verified against real payloads from
// `dodo wh trigger`. Note the CLI's *argument* for the first one is
// "payment.success" while the body says "payment.succeeded" — match the body.
const PLAN_FOR = {
  "payment.succeeded": "family",
  "subscription.active": "family",
  "subscription.renewed": "family",
  "subscription.cancelled": "founding",
  "subscription.expired": "founding",
  "subscription.failed": null,
  "payment.failed": null,
};

const to10 = (raw) => {
  const digits = String(raw || "").replace(/\D/g, "");
  if (/^91\d{10}$/.test(digits)) return digits.slice(2);
  return /^\d{10}$/.test(digits) ? digits : null;
};

/**
 * Dig the household number out of a payload.
 * Primary: the checkout link carries ?metadata_phone=… , which Dodo hands back
 * on data.metadata (confirmed on both Payment and Subscription payloads).
 * Fallback: the number the payer typed at checkout. Used only when metadata is
 * missing, and the caller still has to match it to a real registration before
 * acting on it — so a stranger's number changes nothing.
 * @returns {{phone: string|null, via: 'metadata'|'customer'|null}}
 */
function phoneFrom(event) {
  const d = event?.data || {};
  const meta = d.metadata || d.payload?.metadata || event?.metadata || {};
  const tagged = to10(meta.phone || meta.metadata_phone || meta.household);
  if (tagged) return { phone: tagged, via: "metadata" };
  const payer = to10(d.customer?.phone_number);
  return payer ? { phone: payer, via: "customer" } : { phone: null, via: null };
}

// Payment events carry total_amount; Subscription events carry
// recurring_pre_tax_amount. Both are in the minor unit (paise).
function amountFrom(event) {
  const d = event?.data || {};
  const a = d.total_amount ?? d.amount ?? d.recurring_pre_tax_amount ?? null;
  return a == null ? null : Number(a);
}

module.exports = { verifyWebhook, PLAN_FOR, phoneFrom, amountFrom, configured: () => !!SECRET() };
