import { useEffect, useRef, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { Ticker, Nav } from '../sections/Nav'
import { Footer } from '../sections/Footer'
import { Reveal, Section, SectionHead } from '../components/Primitives'
import { Arch, type ArchTone } from '../components/Arch'
import { Confetti } from '../components/Confetti'
import { OpenSignIn } from '../components/Auth'
import { LangSelect } from '../components/LangSelect'
import { authFetch, clerkConfigured } from '../lib/auth'
import { API } from '../lib/api'

type Counts = {
  seats: number
  founding: number
  free_months: number
  taken: number
  remaining: number
  founding_left: number
}

/* What the page renders before the server answers — and what it keeps showing
   if the server never does. A waitlist that says "loading" is a waitlist nobody
   joins, so the promise is always on screen. */
const FALLBACK: Counts = {
  seats: 50,
  founding: 10,
  free_months: 3,
  taken: 0,
  remaining: 50,
  founding_left: 10,
}

type Claim = {
  seat: number
  tier: string
  already: boolean
  /* Whether the server actually handed a confirmation to Resend. Promising an
     inbox we never wrote to is worse than staying quiet, so the page only says
     "check your email" when the send was attempted. */
  emailed?: boolean
  email?: string | null
}

export function WaitlistPage() {
  const [counts, setCounts] = useState<Counts>(FALLBACK)
  const [claim, setClaim] = useState<Claim | null>(null)
  const [party, setParty] = useState(false)

  const refresh = () =>
    fetch(`${API}/api/waitlist`)
      .then((r) => r.json())
      .then((c: Counts) => c && typeof c.seats === 'number' && setCounts(c))
      .catch(() => {
        /* keep the fallback — the offer is still true when the server is down */
      })

  useEffect(() => {
    void refresh()
  }, [])

  return (
    <>
      <Ticker />
      <Nav />
      <main>
        <Hero counts={counts} />
        <Seats
          counts={counts}
          claim={claim}
          onClaim={(c) => {
            setClaim(c)
            /* Only a seat they didn't already have is worth throwing paper over. */
            if (!c.already) setParty(true)
            void refresh()
          }}
        />
        <WhatYouGet counts={counts} />
        <Numbers counts={counts} />
        <Faq counts={counts} />
      </main>
      <Footer />
      {party && <Confetti />}
    </>
  )
}

/* ── hero ─────────────────────────────────────────────────────────── */

function Hero({ counts }: { counts: Counts }) {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[620px]"
        style={{
          background:
            'radial-gradient(120% 70% at 50% -10%, #d5e2ff 0%, rgba(213,226,255,0.35) 38%, rgba(245,245,243,0) 72%)',
        }}
      />

      <div className="relative mx-auto w-full max-w-[1180px] px-5 pt-14 pb-16 sm:px-8 sm:pt-20 sm:pb-24">
        <Mosaic />

        <Reveal className="mx-auto mt-12 max-w-3xl text-center">
          <span className="border-st-secondary text-tx-secondary inline-flex items-center gap-2 rounded-full border bg-white/80 px-3.5 py-1.5 font-mono text-[10px] tracking-[0.14em] uppercase backdrop-blur">
            <span className="bg-sr-green-600 live-dot h-1.5 w-1.5 rounded-full" />
            Yaadein · the first {counts.seats} families
          </span>

          <h1 className="font-season text-tx mt-8 text-[40px] leading-[1.04] tracking-[-0.02em] text-balance sm:text-[64px]">
            {counts.seats} families.{' '}
            <em className="text-sr-indigo-700 not-italic">Then</em> we start
            charging.
          </h1>

          <p className="text-tx-secondary mx-auto mt-7 max-w-2xl text-[17px] leading-relaxed text-pretty sm:text-[18px]">
            Yaadein is working today — it talks with your parent in their own
            language, remembers what they told it last week, and quietly tracks
            whether the memory came back. We&apos;re taking {counts.seats}{' '}
            families into the first group.{' '}
            <span className="text-tx">
              All {counts.seats} pay nothing for {counts.free_months} months.{' '}
              {counts.founding} of them never pay at all.
            </span>
          </p>

          <div className="mt-9 flex items-center justify-center">
            <ClaimCta className="pill pill-primary !px-7 !py-3.5 !text-[16px]" />
          </div>

          <p className="text-tx-tertiary mt-5 font-mono text-[10px] tracking-[0.14em] uppercase">
            No card · no contract
          </p>
        </Reveal>
      </div>
    </section>
  )
}

/* sarvam.ai runs a pixel-mosaic band across the top of the page. Rendered as
   cells rather than a CSS gradient so the accent colours land on chosen
   squares — a repeating gradient can only ever produce a uniform rhythm. */
const CELLS = 'ooxooo·oo■oo·xoooo■o·ooxo·o■ooox·oooo■·xoo·ooxoo'

function Mosaic() {
  return (
    <div aria-hidden className="flex justify-center gap-[3px] overflow-hidden">
      {[...CELLS].map((c, i) => (
        <span
          key={i}
          className={`h-3.5 w-3.5 shrink-0 rounded-[2px] ${
            c === '■'
              ? 'bg-sr-warm-600/80'
              : c === 'x'
                ? 'bg-sr-indigo-600/70'
                : c === '·'
                  ? 'bg-st-secondary/60'
                  : 'border-st-secondary/70 border'
          }`}
        />
      ))}
    </div>
  )
}

/* ── the seats panel ──────────────────────────────────────────────── */

function Seats({
  counts,
  claim,
  onClaim,
}: {
  counts: Counts
  claim: Claim | null
  onClaim: (c: Claim) => void
}) {
  const full = counts.remaining <= 0

  return (
    <Section id="seats" tone="white">
      <Reveal className="card overflow-hidden !rounded-[28px] p-0">
        <div className="border-st-secondary flex items-center justify-between gap-3 border-b px-6 py-5 sm:px-8">
          <h2 className="font-season text-tx text-[22px] sm:text-[26px]">
            {claim ? 'Your seat is held' : 'Claim a seat'}
          </h2>
          <span className="text-tx-secondary flex shrink-0 items-center gap-2 font-mono text-[10px] tracking-[0.14em] uppercase">
            <span className="bg-sr-green-600 live-dot h-1.5 w-1.5 rounded-full" />
            {full ? 'Cohort full' : `${counts.remaining} of ${counts.seats} left`}
          </span>
        </div>

        <div className="grid gap-8 px-6 py-8 sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12">
          <SeatGrid counts={counts} mine={claim?.seat ?? null} />
          {claim ? (
            <Claimed claim={claim} counts={counts} />
          ) : (
            <Join counts={counts} onClaim={onClaim} />
          )}
        </div>
      </Reveal>
    </Section>
  )
}

function SeatGrid({ counts, mine }: { counts: Counts; mine: number | null }) {
  return (
    <div>
      <div
        className="grid grid-cols-10 gap-1.5"
        role="img"
        aria-label={`${counts.taken} of ${counts.seats} seats taken`}
      >
        {Array.from({ length: counts.seats }, (_, i) => {
          const seat = i + 1
          const founding = seat <= counts.founding
          const taken = seat <= counts.taken
          const isMine = seat === mine
          return (
            <span
              key={seat}
              title={
                founding ? `Seat ${seat} — free forever` : `Seat ${seat}`
              }
              className={`aspect-square rounded-[5px] border transition-colors ${
                isMine
                  ? 'border-tx bg-tx ring-sr-indigo-300 ring-2'
                  : taken
                    ? founding
                      ? 'border-sr-warm-600 bg-sr-warm-600'
                      : 'border-tx bg-tx'
                    : founding
                      ? 'border-sr-warm-200 bg-sr-warm-50'
                      : 'border-st-secondary bg-white'
              }`}
            />
          )
        })}
      </div>

      <div className="text-tx-tertiary mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] tracking-[0.12em] uppercase">
        <Key className="bg-sr-warm-50 border-sr-warm-200" label={`${counts.founding} free forever`} />
        <Key className="border-st-secondary bg-white" label="Free for 3 months" />
        <Key className="bg-tx border-tx" label="Taken" />
      </div>

      <p className="text-tx-tertiary mt-5 text-[12.5px] leading-relaxed text-pretty">
        Seats are handed out in the order they&apos;re claimed. The first{' '}
        {counts.founding} become Founding Families — they keep Yaadein free for
        good, and we ask them for honest feedback instead of money.
      </p>
    </div>
  )
}

function Key({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-[3px] border ${className}`} />
      {label}
    </span>
  )
}

/* ── joining ──────────────────────────────────────────────────────── */

/* The hero button. It scrolls to the form, in every state.
   It used to open the Google overlay for anyone signed out — which put an
   account in front of a waitlist. Signing in is now the shortcut offered
   inside the form, not the toll gate in front of it. */
function ClaimCta({ className }: { className: string }) {
  /* A button, not <a href="#seats">.
     The whole app is hash-routed (#/waitlist, #/try, #/family), so setting the
     hash to "#seats" matched no route and fell through to the landing page —
     the button threw you off the waitlist instead of scrolling down it. Moving
     the page without touching the hash is the fix. */
  return (
    <button
      type="button"
      onClick={() =>
        document.getElementById('seats')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      className={className}
    >
      Claim your seat
      <Arrow />
    </button>
  )
}

/* Clerk's hooks need a ClerkProvider, and <AuthProvider> only mounts one when a
   publishable key exists. clerkConfigured() is read from the bundle's env at
   module load, so it never changes between renders and this split can't
   reorder hooks. Without a key the page falls back to name + email — it must
   never dead-end just because a build variable is missing. */
function Join({ counts, onClaim }: { counts: Counts; onClaim: (c: Claim) => void }) {
  if (!clerkConfigured()) return <SeatForm counts={counts} onClaim={onClaim} identity={null} />
  return <ClerkJoin counts={counts} onClaim={onClaim} />
}

/* Signed in, the form is pre-filled from the Google account and keys the seat to
   it. Signed out, the SAME form appears asking for a name and an email.

   It used to show a sign-in wall instead, and the server backed that up with a
   401 — so every stranger who read the page and wanted in was asked for a
   Google account before they could join a free waitlist. The account is a
   convenience (the seat survives a changed address, and it is how they get back
   into the dashboard later), which makes it a shortcut to offer inside the form,
   not a gate to put in front of it. */
function ClerkJoin({ counts, onClaim }: { counts: Counts; onClaim: (c: Claim) => void }) {
  const { isLoaded, isSignedIn, user } = useUser()

  /* Coming back from the Google overlay, put them on the form they signed in to
     reach. Clerk may return by remount or by full redirect; either way this only
     fires on the transition into signed-in, never on a plain reload. */
  const wasSignedIn = useRef(false)
  useEffect(() => {
    if (!isLoaded) return
    if (isSignedIn && !wasSignedIn.current) {
      document.getElementById('seats')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    wasSignedIn.current = !!isSignedIn
  }, [isLoaded, isSignedIn])

  return (
    <SeatForm
      counts={counts}
      onClaim={onClaim}
      identity={
        isSignedIn
          ? {
              name: user?.fullName || user?.firstName || '',
              email: user?.primaryEmailAddress?.emailAddress || '',
            }
          : null
      }
    />
  )
}

function SeatForm({
  counts,
  onClaim,
  identity,
}: {
  counts: Counts
  onClaim: (c: Claim) => void
  identity: { name: string; email: string } | null
}) {
  const [name, setName] = useState(identity?.name ?? '')
  const [email, setEmail] = useState(identity?.email ?? '')
  const [elder, setElder] = useState('')
  const [lang, setLang] = useState('hi-IN')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const signedIn = identity !== null

  const submit = async () => {
    if (!signedIn && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setErr('Please enter an email address we can reach you on.')
      return
    }
    if (!elder.trim()) {
      setErr('Please tell us their name — Yaadein greets them with it.')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const r = await authFetch(`${API}/api/waitlist`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          elder_name: elder.trim(),
          language: lang,
          phone: phone.trim(),
          note: note.trim(),
        }),
      })
      const j = await r.json()
      if (!r.ok || !j.ok) throw new Error(j.message || 'Could not hold the seat.')
      onClaim({
        seat: j.seat, tier: j.tier, already: j.already,
        emailed: !!j.emailed, email: j.email ?? null,
      })
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const input =
    'border-st-secondary text-tx focus:border-tx w-full rounded-xl border bg-white px-4 py-3 text-[15px] outline-none transition-colors'

  return (
    <div>
      <p className="font-season text-tx text-[24px] leading-tight text-balance sm:text-[28px]">
        Who is Yaadein for?
      </p>
      <p className="text-tx-secondary mt-2.5 text-[14.5px] leading-relaxed text-pretty">
        {signedIn
          ? `Signed in as ${identity.email || identity.name}. Two more answers and the seat is yours.`
          : 'So the very first hello is warm, and in the right language.'}
      </p>

      {/* The shortcut, offered — not required. Google fills the two fields
          below and keys the seat to an account rather than an address, which is
          what gets them back into the dashboard later. Skipping it costs
          nothing but typing. */}
      {!signedIn && clerkConfigured() && (
        <div className="mt-5">
          <OpenSignIn className="pill pill-ghost w-full justify-center !py-3 !text-[14.5px]">
            <GoogleMark />
            Continue with Google
          </OpenSignIn>
          <div className="mt-4 flex items-center gap-3">
            <span className="bg-st-secondary h-px flex-1" />
            <span className="text-tx-tertiary font-mono text-[9.5px] tracking-[0.16em] uppercase">
              or just tell us
            </span>
            <span className="bg-st-secondary h-px flex-1" />
          </div>
        </div>
      )}

      <div className="mt-5 space-y-3">
        {!signedIn && (
          <>
            <input
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={input}
            />
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={input}
            />
          </>
        )}
        <input
          placeholder="Their name (e.g. Kamala)"
          value={elder}
          onChange={(e) => setElder(e.target.value)}
          className={input}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <LangSelect value={lang} onChange={setLang} />
          <input
            inputMode="numeric"
            /* their parent's number, not the signer-up's — see PhoneGate */
            autoComplete="off"
            maxLength={10}
            placeholder="Their number (optional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            className={input + ' tracking-[0.06em]'}
          />
        </div>
        <input
          placeholder="Anything we should know? (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
          className={input}
        />
      </div>

      {err && <p className="mt-3 text-[13px] text-red-700">{err}</p>}

      <button
        onClick={() => void submit()}
        disabled={busy}
        className="pill pill-primary mt-5 w-full justify-center !py-3 !text-[15px] disabled:opacity-40"
      >
        {busy ? 'Holding your seat…' : `Hold my seat — #${counts.taken + 1} of ${counts.seats}`}
      </button>

      <p className="text-tx-tertiary mt-3 text-[12.5px] leading-relaxed text-pretty">
        Give us their number and we can switch Yaadein on the same day. Leave it
        out and we&apos;ll email you first — the seat is held either way.
      </p>
    </div>
  )
}

function Claimed({ claim, counts }: { claim: Claim; counts: Counts }) {
  const founding = claim.tier === 'founding'
  return (
    <div className="flex flex-col justify-center">
      <p className="eyebrow">
        {claim.already ? 'You already had one' : 'Seat confirmed'}
      </p>
      <p className="font-season text-tx mt-3 text-[52px] leading-none sm:text-[64px]">
        #{claim.seat}
        <span className="text-tx-tertiary font-matter text-[16px] font-normal">
          {' '}
          of {counts.seats}
        </span>
      </p>
      <p className="text-tx-secondary mt-4 text-[15px] leading-relaxed text-pretty">
        {founding ? (
          <>
            You&apos;re a{' '}
            <span className="text-sr-warm-900 bg-sr-warm-50 border-sr-warm-200 rounded-md border px-1.5 py-0.5 font-medium">
              Founding Family
            </span>
            . Yaadein stays free for you — not for three months, for good. We&apos;ll
            ask you for honest feedback instead.
          </>
        ) : (
          <>
            Free for the next {counts.free_months} months. After that it&apos;s
            ₹1,499 a month, and we&apos;ll ask you before a single rupee moves.
          </>
        )}
      </p>
      {/* Only shown when the server actually handed a message to Resend —
          `emailed` comes back false when no key is set, and a page that says
          "check your email" about a mail nobody sent is a worse first
          impression than saying nothing. */}
      {claim.emailed ? (
        <p className="border-st-secondary text-tx-secondary mt-5 flex items-start gap-2.5 rounded-xl border bg-white px-3.5 py-3 text-[13px] leading-relaxed">
          <MailIcon />
          <span>
            <span className="text-tx font-medium">Check your email.</span> We&apos;ve
            sent your seat confirmation
            {claim.email ? (
              <>
                {' '}
                to <span className="text-tx">{claim.email}</span>
              </>
            ) : null}
            {' '}— it has everything that happens next. If it isn&apos;t there in a
            minute, look in Promotions or spam.
          </span>
        </p>
      ) : (
        <p className="text-tx-tertiary mt-3 text-[13px] leading-relaxed text-pretty">
          We&apos;ll be in touch to set the phone up. Nothing to pay, nothing to
          install.
        </p>
      )}
      <div className="mt-6 flex flex-wrap gap-2.5">
        <a href="#/try" className="pill pill-primary !py-2.5 !text-[14px]">
          Talk to Yaadein now
          <Arrow />
        </a>
        <a href="#/family" className="pill pill-ghost !py-2.5 !text-[14px]">
          Open the family dashboard
        </a>
      </div>
    </div>
  )
}

/* ── what a seat is worth ─────────────────────────────────────────── */

function WhatYouGet({ counts }: { counts: Counts }) {
  const tiles: { tone: ArchTone; value: string; label: string; body: string }[] = [
    {
      tone: 'purple',
      value: '₹0',
      label: `for ${counts.free_months} months`,
      body: 'Every seat in the cohort. The full product — daily conversation, the family dashboard, their memory book — with nothing to pay and no card taken.',
    },
    {
      tone: 'warm',
      value: String(counts.founding),
      label: 'never pay',
      body: `The first ${counts.founding} families keep Yaadein free permanently. We would rather have ${counts.founding} families who tell us the truth than ${counts.founding} invoices.`,
    },
    {
      tone: 'green',
      value: '11',
      label: 'languages',
      body: 'Hindi, Kannada, Tamil, Telugu, Marathi, Bengali, Gujarati, Malayalam, Punjabi, Odia, English. Your mother or your father talks the way they talk at home.',
    },
  ]

  return (
    <Section tone="sf">
      <SectionHead
        eyebrow="what a seat gets you"
        title="Everything, straight away. Nothing to pay."
        lede="This isn’t a trial with features locked behind an upgrade. A seat is the whole product, from the first conversation."
        align="center"
      />
      <div className="grid gap-10 sm:grid-cols-3">
        {tiles.map((t, i) => (
          <Reveal key={t.label} delay={i * 90} className="flex flex-col items-center text-center">
            <Arch tone={t.tone} size={186}>
              <span className="font-season text-tx text-[38px] leading-none">{t.value}</span>
              <span className="eyebrow mt-1.5">{t.label}</span>
            </Arch>
            <p className="text-tx-secondary mt-4 max-w-[300px] text-[14px] leading-relaxed text-pretty">
              {t.body}
            </p>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}

/* ── the numbers band ─────────────────────────────────────────────── */

function Numbers({ counts }: { counts: Counts }) {
  const items = [
    { value: String(counts.seats), label: 'seats in the first cohort' },
    { value: String(counts.founding), label: 'of them, free forever' },
    { value: `${counts.free_months} months`, label: 'free for everyone else' },
    { value: '₹1,499', label: 'a month, only after that' },
  ]
  return (
    <Section tone="ink">
      <dl className="grid grid-cols-2 gap-y-10 sm:grid-cols-4">
        {items.map((s, i) => (
          <Reveal key={s.label} delay={i * 70} className="px-2 text-center">
            <dt className="font-season text-[36px] leading-none text-white sm:text-[44px]">
              {s.value}
            </dt>
            <dd className="eyebrow mt-3 !text-white/45">{s.label}</dd>
          </Reveal>
        ))}
      </dl>
    </Section>
  )
}

/* ── questions ────────────────────────────────────────────────────── */

function Faq({ counts }: { counts: Counts }) {
  const qs = [
    {
      q: `What happens after the ${counts.free_months} months?`,
      a: `We ask you. If Yaadein has become part of their day, it's ₹1,499 a month — about ₹50 a day, against the ₹40,000 a month a trained memory-care attendant costs. If it hasn't, you stop, and we'd genuinely like to know why. Nothing charges itself.`,
    },
    {
      q: 'Do you need my card now?',
      a: `No. There is no card field anywhere on this page, and we haven't switched payments on yet. A seat costs nothing to hold.`,
    },
    {
      q: `Who gets the ${counts.founding} free-forever seats?`,
      a: `The first ${counts.founding} families to claim one. It isn't a draw and we don't pick favourites — the seat grid above shows exactly how many are gone.`,
    },
    {
      q: 'Does my parent have to sign in or learn an app?',
      a: 'No. You sign in; they never do. They get a link on the phone they already use, tap one orb, and talk. Asking someone with memory loss to remember a password would defeat the entire point.',
    },
    {
      q: 'What if they don’t take to it?',
      a: 'Then don’t pay for it. Tell us and we stop. We’d rather have an honest no than a quiet subscription nobody uses.',
    },
    {
      q: 'Where does what they say end up?',
      a: 'On our server, readable only by the family account that set the household up. It is never used to sell them anything, and we do not share it.',
    },
  ]

  return (
    <Section tone="white">
      <SectionHead eyebrow="before you claim one" title="Your questions, answered." />
      <div className="border-st-secondary border-t">
        {qs.map((item, i) => (
          <Reveal key={item.q} delay={i * 40}>
            <details className="border-st-secondary group border-b">
              <summary className="text-tx flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[16px] font-medium sm:text-[17px]">
                {item.q}
                <span className="text-tx-tertiary shrink-0 text-[20px] leading-none transition-transform duration-200 group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="text-tx-secondary max-w-3xl pr-10 pb-6 text-[15px] leading-relaxed text-pretty">
                {item.a}
              </p>
            </details>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}

/* ── bits ─────────────────────────────────────────────────────────── */

function Arrow() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M3 11 11 3M5 3h6v6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function MailIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className="text-tx-tertiary mt-[3px] shrink-0"
    >
      <rect x="1.5" y="3.5" width="13" height="9" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 5 8 8.8 13.5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  )
}
