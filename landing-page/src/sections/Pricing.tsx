import { useEffect, useState } from 'react'
import { Reveal, Section, SectionHead } from '../components/Primitives'
import { getStoredPhone } from '../components/PhoneGate'
import { API } from '../lib/api'

type Plan = {
  key: string
  name: string
  price: number
  period: string
  checkout_url: string | null
}
type Waitlist = {
  seats: number
  founding: number
  free_months: number
  taken: number
  remaining: number
  founding_left: number
}
type PlansResponse = {
  plans: Plan[]
  current_plan: string | null
  waitlist: Waitlist
  mode: string
}

/* The offer is on screen before the server answers, and stays there if it never
   does — a price card that says "loading" sells nothing. */
const FALLBACK: Waitlist = {
  seats: 50,
  founding: 10,
  free_months: 3,
  taken: 0,
  remaining: 50,
  founding_left: 10,
}

/* Everything the page says about a tier lives here; the server only
   supplies price, availability and the link. */
const COPY: Record<
  string,
  { tagline: string; lines: string[]; foot: string; cta: string; accent: boolean }
> = {
  founding: {
    tagline: 'For the first ten families to claim a seat.',
    lines: [
      'A conversation every day, in their own language',
      'The family dashboard — what they said, what came back',
      'Their memory book, written as they talk',
    ],
    foot: 'Free forever, with a founding badge. We want your feedback more than your money.',
    cta: 'Claim a founding seat',
    accent: false,
  },
  family: {
    tagline: 'For families who want the full picture.',
    lines: [
      'Everything in Founding Family',
      'A weekly digest on WhatsApp — no app to open',
      'Priority voices and photo conversations',
      'Recall trends the doctor can actually read',
    ],
    foot: '₹50 a day, once it starts. A trained memory-care attendant costs ₹40,000 a month — and doesn’t speak their language.',
    cta: 'Claim a free seat',
    accent: true,
  },
  centre: {
    tagline: 'For day-care centres and memory clinics.',
    lines: [
      'Session Scribe — recorded sessions become written reports',
      'Member dashboards for every resident',
      'White-label family reports',
      'Your psychologist stops hand-writing progress notes',
    ],
    foot: 'One to two percent of what a seat already costs you. Start with one resident and add seats as you go.',
    /* Was "Talk to us", which pointed at a WhatsApp number we never set — and
       then fell through to the family waitlist. The button now does what it
       says: it starts a centre subscription. */
    cta: 'Set up your centre',
    accent: false,
  },
}

const ORDER = ['founding', 'family', 'centre']

/* Dodo's hosted checkout honours ?quantity= but renders it read-only — there is
   no stepper on their page. So the seat count has to be decided here, before we
   hand the centre over, or every home would be billed for exactly one resident.
   Parsed rather than concatenated because the link already carries `quantity=1`
   from the env var and may carry `metadata_phone` too. */
const SEAT_CAP = 200
function withSeats(url: string | null | undefined, n: number): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    u.searchParams.set('quantity', String(n))
    return u.toString()
  } catch {
    return url
  }
}

export function Pricing() {
  const [data, setData] = useState<PlansResponse | null>(null)
  const [seats, setSeats] = useState(10)

  useEffect(() => {
    const phone = getStoredPhone()
    fetch(`${API}/api/plans${phone ? `?phone=${phone}` : ''}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {
        /* keep the fallback terms — they're true whether or not we reach the server */
      })
  }, [])

  const wl = data?.waitlist ?? FALLBACK
  const byKey = new Map((data?.plans ?? []).map((p) => [p.key, p]))
  return (
    <Section id="pricing" tone="sf">
      <SectionHead
        eyebrow="what it costs"
        title="Nothing, for the first fifty families."
        lede={`Families already spend ₹45,000 to ₹2,00,000 a year on this. Most of it goes on care that arrives twice a week and leaves again. We're opening ${wl.seats} seats — every one of them free for ${wl.free_months} months, and the first ${wl.founding} free for good.`}
      />

      <div className="grid items-start gap-4 lg:grid-cols-3">
        {ORDER.map((key, i) => {
          const copy = COPY[key]
          const plan = byKey.get(key)
          const isCurrent = data?.current_plan === key
          const isCentre = key === 'centre'
          const isFamily = key === 'family'

          /* No tier is ever disabled now. For families there is nothing to
             charge, so the seat itself is the call to action and the Dodo link
             sits underneath as a way to pay early.

             Centres are the other way round: the seat form is the *families*
             waitlist, so sending a care home there offered them the wrong
             product entirely. Their checkout is the primary action — until we
             have a contact channel, it is the only route they have to us. */
          const href = (isCentre ? withSeats(plan?.checkout_url, seats) : null) ?? '#/waitlist'
          const payNow = isFamily ? plan?.checkout_url ?? null : null

          return (
            <Reveal
              key={key}
              delay={i * 80}
              className={`card flex h-full flex-col p-6 ${
                copy.accent ? 'border-sr-indigo-200 ring-sr-indigo-100 ring-2' : ''
              }`}
            >
              <div className="mb-4 flex items-center justify-between gap-2">
                <span className="eyebrow">{plan?.name ?? key}</span>
                {copy.accent && (
                  <span className="border-sr-green-200 bg-sr-green-50 text-sr-green-800 rounded-full border px-2.5 py-1 font-mono text-[9.5px] tracking-[0.14em] uppercase">
                    Not charging yet
                  </span>
                )}
                {key === 'founding' && (
                  <span className="border-sr-warm-200 bg-sr-warm-50 text-sr-warm-900 rounded-full border px-2.5 py-1 font-mono text-[9.5px] tracking-[0.14em] uppercase">
                    {wl.founding_left} left
                  </span>
                )}
                {isCurrent && (
                  <span className="border-sr-indigo-200 bg-sr-indigo-50 text-sr-indigo-700 rounded-full border px-2.5 py-1 font-mono text-[9.5px] tracking-[0.14em] uppercase">
                    Your plan
                  </span>
                )}
              </div>

              {isFamily ? (
                <>
                  <p className="font-season text-tx text-[40px] leading-none">
                    ₹0
                    <span className="text-tx-tertiary font-matter text-[14px] font-normal">
                      {' '}
                      for {wl.free_months} months
                    </span>
                  </p>
                  <p className="text-tx-tertiary mt-2 text-[13px]">
                    then ₹{(plan?.price ?? 1499).toLocaleString('en-IN')} /{' '}
                    {plan?.period ?? 'month'} — and we ask you first
                  </p>
                </>
              ) : (
                <p className="font-season text-tx text-[40px] leading-none">
                  {plan && plan.price > 0 ? `₹${plan.price.toLocaleString('en-IN')}` : 'Free'}
                  {plan && plan.price > 0 && (
                    <span className="text-tx-tertiary font-matter text-[14px] font-normal">
                      {' '}
                      / {plan.period}
                    </span>
                  )}
                </p>
              )}

              <p className="text-tx-secondary mt-3 text-[14px] leading-relaxed text-pretty">
                {copy.tagline}
              </p>

              <ul className="mt-5 mb-5 flex-1 space-y-2.5">
                {copy.lines.map((l) => (
                  <li
                    key={l}
                    className="border-st-secondary bg-white/60 text-tx-secondary rounded-[12px] border px-3.5 py-2.5 text-[13px] leading-relaxed text-pretty"
                  >
                    {l}
                  </li>
                ))}
              </ul>

              {/* The seat count travels in the checkout URL, so it has to be
                  chosen before they leave. ₹600 is tax-inclusive on the Dodo
                  product, which is why this multiplies straight up to the total
                  they will actually be shown. */}
              {isCentre && plan?.checkout_url && (
                <div className="border-st-secondary mb-3 flex items-center justify-between gap-3 rounded-[12px] border px-3.5 py-2.5">
                  <label htmlFor="centre-seats" className="text-tx-secondary text-[13px]">
                    Residents
                  </label>
                  <div className="flex items-center gap-2.5">
                    <input
                      id="centre-seats"
                      type="number"
                      min={1}
                      max={SEAT_CAP}
                      value={seats}
                      onChange={(e) => {
                        const n = Math.round(Number(e.target.value))
                        setSeats(Number.isFinite(n) ? Math.min(SEAT_CAP, Math.max(1, n)) : 1)
                      }}
                      className="border-st-secondary text-tx focus:border-tx w-16 rounded-[9px] border bg-white px-2 py-1 text-center text-[13px] tabular-nums outline-none transition-colors"
                    />
                    <span className="text-tx text-[13px] font-medium tabular-nums">
                      ₹{((plan?.price ?? 600) * seats).toLocaleString('en-IN')}/mo
                    </span>
                  </div>
                </div>
              )}

              <a
                href={href}
                {...(href.startsWith('http')
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
                className={`pill w-full justify-center !py-2.5 !text-[14px] ${
                  copy.accent ? 'pill-primary' : 'pill-ghost'
                }`}
              >
                {copy.cta}
              </a>

              {payNow && (
                <a
                  href={payNow}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-tx-tertiary hover:text-tx mt-2.5 text-center text-[12.5px] underline transition-colors"
                >
                  or start paying now
                </a>
              )}

              <p className="text-tx-tertiary mt-4 text-[12.5px] leading-relaxed text-pretty">
                {copy.foot}
              </p>
            </Reveal>
          )
        })}
      </div>

      <Reveal delay={200}>
        <p className="text-tx-tertiary mx-auto mt-10 max-w-2xl text-center text-[15px] leading-relaxed text-pretty">
          No contract, and no card to start.{' '}
          <span className="text-tx">
            If a week goes by where they don’t want to talk, don’t pay for it.
          </span>
        </p>
      </Reveal>

      {data?.mode === 'test' && (
        <p className="text-tx-tertiary mt-4 text-center font-mono text-[10px] tracking-[0.14em] uppercase opacity-60">
          Checkout in test mode
        </p>
      )}
    </Section>
  )
}
