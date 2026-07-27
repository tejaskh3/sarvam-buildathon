// Clerk session verification — zero npm dependencies.
//
// The browser holds the Clerk session; the React SDK hands us a short-lived
// session JWT. All the server does is prove that JWT really came from our Clerk
// instance and hasn't expired. Clerk publishes the signing keys as a JWKS, so
// instead of pulling in @clerk/backend we fetch that JWKS, cache it, and verify
// the RS256 signature with node:crypto.
//
// Who signs in: the FAMILY (the adult child). The elder never signs in — they
// speak into a device that already knows the household's number. So Clerk
// protects the dashboard, and the voice session stays reachable without a login.
//
// Reference: https://clerk.com/docs/backend-requests/handling/manual-jwt

const crypto = require("crypto");

// Either give us the issuer directly, or we derive it from the publishable key,
// which encodes the instance domain (pk_test_<base64(domain$)>).
function issuer() {
  if (process.env.CLERK_ISSUER) return process.env.CLERK_ISSUER.replace(/\/$/, "");
  const pk = process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY;
  if (!pk) return null;
  const m = /^pk_(test|live)_(.+)$/.exec(pk.trim());
  if (!m) return null;
  try {
    const domain = Buffer.from(m[2], "base64").toString("utf8").replace(/\$$/, "");
    return domain ? `https://${domain}` : null;
  } catch {
    return null;
  }
}

const enabled = () => !!issuer();
const jwksUrl = () => `${issuer()}/.well-known/jwks.json`;

// ─── JWKS cache ───────────────────────────────────────────────────
let keys = null;      // { kid: KeyObject }
let expiresAt = 0;
let inflight = null;

async function publicKeys() {
  if (keys && Date.now() < expiresAt) return keys;
  if (inflight) return inflight;
  inflight = (async () => {
    const r = await fetch(jwksUrl());
    if (!r.ok) throw new Error(`clerk jwks ${r.status}`);
    const body = await r.json();
    const next = {};
    for (const jwk of body.keys || []) {
      if (jwk.kty !== "RSA" || !jwk.kid) continue;
      try {
        next[jwk.kid] = crypto.createPublicKey({ key: jwk, format: "jwk" });
      } catch { /* skip a key we can't parse rather than failing every request */ }
    }
    if (!Object.keys(next).length) throw new Error("clerk jwks empty");
    keys = next;
    expiresAt = Date.now() + 55 * 60 * 1000; // Clerk rotates rarely; refresh hourly
    return keys;
  })().finally(() => { inflight = null; });
  return inflight;
}

const b64url = (s) => Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");

/**
 * Verify a Clerk session token.
 * Throws on anything suspicious — callers treat every throw as 401 and must
 * never echo the message back to the client.
 * @returns {Promise<{userId: string, email: string|null, claims: object}>}
 */
async function verifySession(token) {
  if (!enabled()) throw new Error("clerk not configured");
  if (typeof token !== "string" || !token) throw new Error("no token");

  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("malformed token");
  const [h64, p64, s64] = parts;

  let header, claims;
  try {
    header = JSON.parse(b64url(h64).toString("utf8"));
    claims = JSON.parse(b64url(p64).toString("utf8"));
  } catch { throw new Error("malformed token"); }

  if (header.alg !== "RS256") throw new Error(`bad alg ${header.alg}`);
  if (!header.kid) throw new Error("no kid");

  const ks = await publicKeys();
  let key = ks[header.kid];
  if (!key) {
    expiresAt = 0; // probably a rotation — force one refresh, then give up
    key = (await publicKeys())[header.kid];
    if (!key) throw new Error("unknown kid");
  }

  const ok = crypto.createVerify("RSA-SHA256").update(`${h64}.${p64}`).verify(key, b64url(s64));
  if (!ok) throw new Error("bad signature");

  const now = Math.floor(Date.now() / 1000);
  const SKEW = 60; // clocks drift, especially on phones
  if (claims.iss !== issuer()) throw new Error("bad iss");
  if (!claims.sub) throw new Error("no sub");
  if (typeof claims.exp !== "number" || claims.exp + SKEW < now) throw new Error("expired");
  if (typeof claims.nbf === "number" && claims.nbf - SKEW > now) throw new Error("not yet valid");
  if (typeof claims.iat === "number" && claims.iat - SKEW > now) throw new Error("issued in the future");

  return {
    userId: claims.sub,
    // present only if the JWT template includes it; we never depend on it
    email: claims.email || (claims.primary_email_address) || null,
    claims,
  };
}

/** Pull the bearer token off a request, or null. */
function bearer(req) {
  const h = req.headers["authorization"] || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

/**
 * Who is making this request?
 * @returns {Promise<{userId: string}|null>} null when Clerk is off or no valid token
 */
async function userFor(req) {
  if (!enabled()) return null;
  const token = bearer(req);
  if (!token) return null;
  try {
    const { userId } = await verifySession(token);
    return { userId };
  } catch (e) {
    console.warn(`[clerk] rejected token: ${e.message}`);
    return null;
  }
}

module.exports = { enabled, issuer, verifySession, bearer, userFor };
