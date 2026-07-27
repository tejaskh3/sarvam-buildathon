import { useEffect, useState } from 'react'
import { Reveal, Section, SectionHead } from '../components/ui'
import { getStoredPhone } from '../components/PhoneGate'

/* ------------------------------------------------------------------
   Pricing. The checkout links are NOT in this bundle — they come from
   GET /api/plans, which reads them out of the server's environment. So
   a Dodo link can be pasted into Railway and go live on the next page
   load, with no rebuild and no redeploy of the frontend.
   Setup: docs/07-keys-and-accounts.md §1
   ------------------------------------------------------------------ */

const API =
  (import.meta.env.VITE_API_BASE as string | undefined) ??
  (import.meta.env.DEV ? 'http://localhost:3000' : '')

type Plan = {
  key: string
  name: string
  price: number
  period: string
  checkout_url: string | null
}
type PlansResponse = {
  plans: Plan[]
  current_plan: string | null
  contact_whatsapp: string | null
  mode: string
}

/* Everything the page says about a tier lives here; the server only
   supplies price, availability and the link. */
const COPY: Record<
  string,
  { tagline: string; lines: string[]; foot: string; cta: string; accent: boolean }
> = {
  founding: {
    tagline: 'For the first 25 families.',
    lines: [
      'A conversation every day, in her language',
      'The family dashboard — what she said, what came back',
      'Her memory book, written as she talks',
    ],
    foot: 'Forever free, with a founding badge. We want your feedback more than your money.',
    cta: 'Start free',
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
    foot: '₹50 a day. A trained memory-care attendant costs ₹40,000 a month — and doesn’t speak her language.',
    cta: 'Choose Family',
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
    foot: 'One to two percent of what a seat already costs you.',
    cta: 'Talk to us',
    accent: false,
  },
}

const ORDER = ['founding', 'family', 'centre']

export function Pricing() {
  const [data, setData] = useState<PlansResponse | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const phone = getStoredPhone()
    fetch(`${API}/api/plans${phone ? `?phone=${phone}` : ''}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setFailed(true))
  }, [])

  const byKey = new Map((data?.plans ?? []).map((p) => [p.key, p]))
  const whatsapp = data?.contact_whatsapp
    ? `https://wa.me/${data.contact_whatsapp}?text=${encodeURIComponent(
        'Hello — I run a day-care centre and would like to know about Yaadein for our members.',
      )}`
    : null

  return (
    <Section id="pricing" tone="sf">
      <SectionHead
        eyebrow="what it costs"
        title="Cheaper than the help she won’t accept."
        lede="Families already spend ₹45,000 to ₹2,00,000 a year on this. Most of it goes on care that arrives twice a week and leaves again. This is the part that shows up every day."
      />

      <div className="grid items-start gap-4 lg:grid-cols-3">
        {ORDER.map((key, i) => {
          const copy = COPY[key]
          const plan = byKey.get(key)
          const isCurrent = data?.current_plan === key
          const isCentre = key === 'centre'
          /* A tier is buyable once its link exists in the server env.
             Founding is free (opens signup) and the centre tier falls
             back to WhatsApp, which is the better B2B motion anyway. */
          const href =
            key === 'founding' ? '#/try' : plan?.checkout_url ?? (isCentre ? whatsapp : null)
          const disabled = !href && !failed

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
                  <span className="border-sr-indigo-200 bg-sr-indigo-50 text-sr-indigo-700 rounded-full border px-2.5 py-1 font-mono text-[9.5px] tracking-[0.14em] uppercase">
                    Most families
                  </span>
                )}
                {isCurrent && (
                  <span className="border-sr-green-200 bg-sr-green-50 text-sr-green-800 rounded-full border px-2.5 py-1 font-mono text-[9.5px] tracking-[0.14em] uppercase">
                    Your plan
                  </span>
                )}
              </div>

              <p className="font-season text-tx text-[40px] leading-none">
                {plan && plan.price > 0 ? `₹${plan.price.toLocaleString('en-IN')}` : 'Free'}
                {plan && plan.price > 0 && (
                  <span className="text-tx-tertiary font-matter text-[14px] font-normal">
                    {' '}
                    / {plan.period}
                  </span>
                )}
              </p>
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

              {href ? (
                <a
                  href={href}
                  {...(href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className={`pill w-full justify-center !py-2.5 !text-[14px] ${
                    copy.accent ? 'pill-primary' : 'pill-ghost'
                  }`}
                >
                  {copy.cta}
                </a>
              ) : (
                <span
                  aria-disabled
                  className="pill pill-ghost w-full cursor-default justify-center !py-2.5 !text-[14px] opacity-45"
                >
                  {disabled ? 'Coming this week' : copy.cta}
                </span>
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
          No contract, no card to start, cancel from a WhatsApp message.{' '}
          <span className="text-tx">
            If a week goes by where she doesn’t want to talk, don’t pay for it.
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
