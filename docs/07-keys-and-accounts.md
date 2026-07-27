# Keys & Accounts Runbook — Tejas only

Everything here needs a human with a card and a PAN. Claude cannot do any of it.

**The code is done and tested.** Every feature reads its config from env and
degrades cleanly when it's missing, so you paste values into Railway one at a
time and redeploy. Nothing is blocked on engineering.

Status as of the last update:

| | Status |
|---|---|
| Dodo account + KYC | ✅ submitted, under review |
| Dodo payout account | ✅ India / INR / **Local** / Delhi account / PAN as Tax ID |
| Dodo test API key | ⬜ **← you are here** |
| Dodo product + webhook | ⬜ Claude does this once the key lands |
| Clerk application | ⬜ not started (~15 min, independent of Dodo) |

---

## 0. How the two keys get handed over

They are **not** the same kind of secret and must not be handled the same way.

| | Dodo API key | Clerk publishable key |
|---|---|---|
| Secret? | **Yes** — full account access | **No** — ships in the JS bundle by design |
| Paste into chat? | **Never** | Fine |
| Where it lives | `~/.dodo-key`, then encrypted in `~/.dodopayments/config.json` | `landing-page/.env` |

Clerk's publishable key looks like a secret and isn't. It identifies the
instance; it authorises nothing. What actually protects the dashboard is Clerk's
own session verification plus the allowed-origins list in §2b. Don't hide it.

---

## 1. Dodo Payments

### 1a. Done already
Account, KYC (DL — Karnataka), payout account (Delhi, matching PAN + Aadhaar),
transfer method **Local** (not Swift — Swift costs ~$15–30/payout plus FX spread
to move INR into an Indian bank), Tax ID = PAN.

If Dodo ever asks for further address proof, **send the Aadhaar, not the DL** —
Aadhaar shows Delhi and matches your PAN and bank account. The DL is the outlier.

### 1b. Test API key — the only thing blocking Claude

**Test keys do not wait on KYC review.** Only live mode and payouts do.

1. https://app.dodopayments.com/developer/api-keys
2. **Set the toggle to `Test` before creating the key.** Keys are mode-scoped;
   a Live key won't work against `test.dodopayments.com`.
3. **Add API Key** → name `yaadein-server` → write access **on**.
4. The value is shown **once**, in the dialog, with a copy button. There is no
   download. Close it and you must generate a new key.
5. Paste it into `~/.dodo-key` **using your editor** — not the terminal, or it
   lands in shell history.

Then hand it over without it touching this chat:

```bash
chmod 600 ~/.dodo-key && dodo login "$(cat ~/.dodo-key)" test
```

`$(cat …)` keeps the literal key out of both history and the transcript. It's
stored AES-256-GCM encrypted at `~/.dodopayments/config.json`; Claude drives it
through `dodo …` commands without ever reading the value.

> The published docs describe `dodo login` as a browser flow. That's wrong for
> CLI v3.4.0 — it takes the key as a positional argument.

### 1c. What Claude does next
Creates the `Yaadein Family` subscription (₹1,499 / month, INR), pulls its
payment link, registers the webhook endpoint at
`https://sarvam-buildathon-production.up.railway.app/api/dodo/webhook`
subscribed to `payment.succeeded`, `payment.failed`, `subscription.active`,
`subscription.cancelled`, `subscription.failed`, `subscription.expired`, and
retrieves the `whsec_…` signing secret.

Optionally a second product, `Yaadein Care Centre (per seat)` at ₹600/month.
Leave `DODO_CENTRE_LINK` empty and that card falls back to a WhatsApp
"Talk to us", which is the better B2B motion anyway.

### 1d. Webhook testing — already done, no account needed
`dodo wh trigger` emits genuine Dodo payloads offline but unsigned, so it can't
exercise our signature check alone. `scripts/webhook-test.mjs` puts a signing
proxy in between:

```
dodo wh trigger ──unsigned──▶ proxy (signs) ──signed──▶ /api/dodo/webhook
```

```bash
node scripts/webhook-test.mjs --phone=9876543210            # localhost:3000
node scripts/webhook-test.mjs --api=https://<prod> --phone=…
```

Walks the full lifecycle (paid → `family`, cancelled/expired → `founding`,
failed → unchanged), replays every event to prove idempotency, and fires a
forged signature to prove it's rejected. All green.

**What this caught:** the CLI's trigger *argument* is `payment.success`, but the
`type` in the body is `payment.succeeded`. Keying on the CLI name would mean
nobody ever gets upgraded — silently, after their money moved.

### 1e. Going live (after KYC clears)
Flip the dashboard to **Live**, recreate the product (test products don't carry
over), create a live webhook endpoint for a new `whsec_`, update the same env
vars, set `DODO_MODE=live`. No code changes.

---

## 2. Clerk sign-in (~15 min, do it now — independent of Dodo)

We dropped Firebase Phone Auth for Clerk: real sessions, a real sign-out, and no
SMS delivery risk at a hackathon venue.

**Who signs in — read this first.** The **family** signs in (the adult child who
set Yaadein up). The **elder never signs in**: they tap one button and talk.
Asking someone with memory loss to log in would contradict the whole product. So
Clerk protects the family dashboard; the voice page stays keyed to the
household's phone number on that device.

### 2a. Application
1. https://dashboard.clerk.com → **Create application**, name `Yaadein`.
2. Sign-in options: enable **Google** and **Email**. Skip phone/SMS — it costs
   money and Google is what an Indian adult child already has.
3. Copy the **Publishable key** (`pk_test_…`). It is public; paste it in chat.
   You do NOT need the secret key — the server verifies sessions against Clerk's
   public JWKS, so `app/clerk.js` stays at zero npm dependencies.

### 2b. Allowed origins
**Configure → Domains** (or Paths, depending on the dashboard version) → add
`https://sarvam-buildathon-production.up.railway.app`. `localhost` is already
allowed. Sign-in fails silently on any origin Clerk doesn't know.

### 2c. Nothing else
No JWT template, no webhook, no organisation setup. Defaults are fine.

---

## 3. What to paste where

### Railway (server) → Variables, then redeploy
```
SARVAM_API_KEY=…                 # already set
CLERK_PUBLISHABLE_KEY=pk_test_…  # turns family sign-in ON (server-side check)
DODO_WEBHOOK_SECRET=whsec_…      # turns the webhook ON
DODO_API_KEY=…                   # not used yet; set it anyway
DODO_MODE=test                   # flip to `live` after KYC
DODO_FAMILY_LINK=https://test.checkout.dodopayments.com/buy/pdt_…
DODO_CENTRE_LINK=                # empty → card shows "Talk to us"
DODO_CONTACT_WHATSAPP=919XXXXXXXXX
```
The same publishable key is needed at **build time** for the browser:
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_…
```
Set it in `landing-page/.env` (or as a Railway build variable) and **rebuild the
frontend** — it is baked into the bundle. Server-side vars take effect on restart.

### `app/.env` (local dev only, gitignored)
```
SARVAM_API_KEY=…
# leave CLERK_PUBLISHABLE_KEY unset locally: the dashboard stays open so the
# attack suite can run without a browser session
```

---

## 4. Behaviour with keys missing — nothing blocks

| Env var | Unset | Set |
|---|---|---|
| `CLERK_PUBLISHABLE_KEY` (server) | Dashboard endpoints are number-scoped only, exactly as today | Signed-in session required; a household can only be read by the account that claimed it |
| `VITE_CLERK_PUBLISHABLE_KEY` (build) | No sign-in UI, no account button | Sign-in card on `#/family`, avatar + sign-out in the header |
| `DODO_WEBHOOK_SECRET` | `/api/dodo/webhook` returns 503 | Signature enforced, plan upgraded |
| `DODO_FAMILY_LINK` | Family card shows "Coming this week", disabled | Card links to checkout with `metadata_phone` |

**Important:** the elder's own routes (`/api/session/start`, `/api/turn`) and the
public `/api/stats` are never gated — verified by test. Turning Clerk on can
never lock an elder out of their own conversation.

The boot log prints exactly what landed:
```
🪔 Yaadein listening on http://localhost:3000
   ✅ Clerk sign-in (https://…clerk.accounts.dev)   ✅ Dodo webhook   ✅ Family checkout   [test mode]
```

### First sign-in claims the household
The first signed-in account to register a number becomes its owner. Numbers
registered before Clerk was switched on stay unclaimed and readable — the next
signed-in family to enter that number claims it. Once claimed, another account
gets `403 already_claimed`.

---

## 5. How a payment finds the right family

There is no login, so the checkout link carries the household number:

```
<DODO_FAMILY_LINK>?metadata_phone=9876543210
```

Dodo passes anything prefixed `metadata_` through to the webhook, so
`payment.succeeded` arrives with `metadata.phone` and the server runs
`UPDATE registrations SET plan='family' WHERE phone=…`.

Fallback: if metadata is missing (someone shared the raw link), the server tries
`data.customer.phone_number` — the number typed at checkout. Safe because
`setPlan` only touches an *existing* registration, so an unknown number can't
invent a household. Logs say which path was used (`via metadata` / `via customer`).
If neither resolves, the payment is still recorded with `phone=NULL` and logged
as `unattributed` — reconcile by email from the dashboard rather than losing it.

---

## 6. Final gate (plan §9, Phase B)
1. `https://<prod>/#pricing` → **Choose Family**
2. Test card **4242 4242 4242 4242**, any future expiry, any CVC
3. Railway logs: `[dodo] payment.succeeded phone=… (via metadata) plan=family`
4. `GET /api/registrations?admin=1231231239` → that row shows `plan: "family"`

To watch events hit your laptop instead: `dodo wh listen http://localhost:3000/api/dodo/webhook`

---

Sources: [Dodo webhooks](https://docs.dodopayments.com/developer-resources/webhooks) ·
[Dodo API reference](https://docs.dodopayments.com/api-reference/introduction) ·
[Dodo CLI](https://github.com/dodopayments/dodopayments-cli) ·
[Dodo MCP server](https://docs.dodopayments.com/developer-resources/mcp-server) ·
[Clerk: manual JWT verification](https://clerk.com/docs/backend-requests/handling/manual-jwt)
