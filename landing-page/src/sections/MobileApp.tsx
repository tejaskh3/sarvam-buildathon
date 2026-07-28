import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { Reveal, Section, SectionHead } from '../components/Primitives'
import { PhoneFlat } from '../components/PhoneFlat'
import { API } from '../lib/api'

/* ------------------------------------------------------------------
   "Yaadein on their phone" — announced, not shipped.

   The honest version of a coming-soon section. It says what the app will
   add (a home-screen icon, notifications, offline) and, more importantly,
   what it will NOT change: the elder still taps one circle and talks, and
   nothing about the product is waiting on a download. Otherwise a
   coming-soon block reads as "the real thing isn't out yet", which is
   false — the browser IS the product today, on purpose. An elder who has
   to find an icon, keep an app updated and stay signed in is an elder who
   stops using it.

   One field, and an optional which-phone. Anything more is a form
   standing between someone and an announcement.
   ------------------------------------------------------------------ */

type Platform = 'ios' | 'android' | 'either'

const PLATFORMS: { key: Platform; label: string }[] = [
  { key: 'ios', label: 'iPhone' },
  { key: 'android', label: 'Android' },
  { key: 'either', label: 'Either' },
]

/* What the app adds on top of what already works in a browser. Written as
   plain benefits to the elder or the family, not as a feature list — "push
   notifications" is a capability, "you find out the same evening" is a reason
   to want it. */
const PLANNED = [
  {
    title: 'An icon on their home screen',
    body: 'One tap from the lock screen, in the place they already look. No link to find, no browser to open, nothing to keep signed in.',
  },
  {
    title: 'It calls them, gently',
    body: 'A soft notification at the hour they usually talk — the same nudge a daughter gives, without anyone having to remember to give it.',
  },
  {
    title: 'Works where the signal doesn’t',
    body: 'The conversation holds through a dropped connection and finishes uploading later, which matters more in Indore than in a demo.',
  },
]

export function MobileApp() {
  return (
    <Section id="app" tone="white">
      <SectionHead
        eyebrow="coming soon · ios & android"
        title={
          <>
            Yaadein on their phone.{' '}
            <em className="text-sr-indigo-700 not-italic">Soon.</em>
          </>
        }
        lede="We're building the app. We're telling you about it early because the waiting list is short and we'd rather you heard from us than from a launch post."
      />

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-16">
        <div>
          <Phone />
        </div>

        <div>
          <ul className="border-st-secondary border-t">
            {PLANNED.map((f, i) => (
              <Reveal key={f.title} delay={i * 80}>
                <li className="border-st-secondary border-b py-5">
                  <p className="text-tx text-[16px] font-medium">{f.title}</p>
                  <p className="text-tx-secondary mt-1.5 text-[14.5px] leading-relaxed text-pretty">
                    {f.body}
                  </p>
                </li>
              </Reveal>
            ))}
          </ul>

          <Reveal delay={260}>
            <NotifyForm />
          </Reveal>

          {/* The point of the whole section: nobody is waiting on us. */}
          <Reveal delay={320}>
            <p className="text-tx-tertiary border-st-secondary mt-8 border-t pt-6 text-[13px] leading-relaxed text-pretty">
              <span className="text-tx font-medium">
                You don&apos;t need the app to start.
              </span>{' '}
              Everything Yaadein does works in a browser today, which is
              deliberate — you send one link and it opens straight into the
              conversation. The app makes that easier to reach, not possible.{' '}
              <a
                href="#/try"
                className="text-sr-indigo-700 underline decoration-1 underline-offset-2"
              >
                Hear it now
              </a>
              .
            </p>
          </Reveal>
        </div>
      </div>
    </Section>
  )
}

/* ── the sign-up ──────────────────────────────────────────────────── */

function NotifyForm() {
  const [email, setEmail] = useState('')
  const [platform, setPlatform] = useState<Platform>('either')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<{ already: boolean; emailed: boolean } | null>(null)

  const submit = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setErr('Please enter an email address we can reach you on.')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const r = await fetch(`${API}/api/notify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), platform }),
      })
      const j = await r.json()
      if (!r.ok || !j.ok) throw new Error(j.message || 'Could not add you to the list.')
      setDone({ already: !!j.already, emailed: !!j.emailed })
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="border-sr-green-200 bg-sr-green-50/60 mt-8 rounded-2xl border px-5 py-5">
        <p className="eyebrow flex items-center gap-2">
          <span className="bg-sr-green-600 h-1.5 w-1.5 rounded-full" />
          {done.already ? 'You were already on the list' : "You're on the list"}
        </p>
        <p className="font-season text-tx mt-2.5 text-[20px] leading-tight">
          We&apos;ll write the day it&apos;s downloadable.
        </p>
        <p className="text-tx-secondary mt-2 text-[13.5px] leading-relaxed text-pretty">
          {done.emailed
            ? 'Check your email — there’s a note confirming it. One message when the app is out, and nothing in between.'
            : 'One message when the app is out, and nothing in between.'}
        </p>
      </div>
    )
  }

  return (
    <div className="border-st-secondary mt-8 rounded-2xl border bg-white p-5">
      <p className="text-tx text-[15px] font-medium">Tell me when it&apos;s out</p>
      <p className="text-tx-secondary mt-1 text-[13.5px] leading-relaxed">
        One email, on the day. Not a newsletter.
      </p>

      {/* Which phone is a real question for us — it decides which store we
          ship to first — so it is asked, but never required. */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {PLATFORMS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPlatform(p.key)}
            aria-pressed={platform === p.key}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] transition-colors ${
              platform === p.key
                ? 'border-tx bg-tx text-white'
                : 'border-st-secondary text-tx-secondary hover:border-tx bg-white'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
          className="border-st-secondary text-tx focus:border-tx w-full rounded-xl border bg-white px-4 py-2.5 text-[15px] outline-none transition-colors"
        />
        <button
          onClick={() => void submit()}
          disabled={busy}
          className="pill pill-primary shrink-0 justify-center !py-2.5 !text-[14px] disabled:opacity-40"
        >
          {busy ? 'Adding you…' : 'Notify me'}
        </button>
      </div>

      {err && <p className="mt-2.5 text-[13px] text-red-700">{err}</p>}
    </div>
  )
}

/* ── the device ───────────────────────────────────────────────────── */

/* three is ~170KB gzipped and this section is four screens down, so the 3D
   phone is a separate chunk fetched only once it's nearly in view. Until it
   lands — and if it never does, or the machine has no WebGL — the CSS phone
   stands in. Same device either way; the visitor only loses the drag. */
const Phone3D = lazy(async () => {
  try {
    return await import('../components/Phone3D')
  } catch {
    return { default: PhoneFlat }
  }
})

/* Don't fetch a WebGL scene for someone who never scrolls this far.

   Measured on scroll rather than observed: Chrome does not compute
   intersections for a backgrounded or occluded tab, so an
   IntersectionObserver here never fires until the tab is looked at — and the
   section then sits there showing the flat phone. Reveal above already
   carries a note about the same trap. One getBoundingClientRect on one
   element per scroll costs nothing. */
function useNearlyVisible<T extends Element>(margin = 600) {
  const ref = useRef<T>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let done = false
    const check = () => {
      if (done || !ref.current) return
      const r = ref.current.getBoundingClientRect()
      if (r.top < innerHeight + margin && r.bottom > -margin) {
        done = true
        setNear(true)
        removeEventListener('scroll', check)
        removeEventListener('resize', check)
      }
    }
    check()
    addEventListener('scroll', check, { passive: true })
    addEventListener('resize', check)
    return () => {
      done = true
      removeEventListener('scroll', check)
      removeEventListener('resize', check)
    }
  }, [margin])
  return [ref, near] as const
}

function Phone() {
  const [ref, near] = useNearlyVisible<HTMLDivElement>()
  return (
    <Reveal className="flex justify-center">
      <div ref={ref} className="relative">
        {/* the same indigo wash as the hero, so the device sits in our light */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-10 rounded-full"
          style={{
            background:
              'radial-gradient(60% 50% at 50% 40%, rgba(213,226,255,0.85) 0%, rgba(245,245,243,0) 70%)',
          }}
        />

        <div className="relative flex justify-center">
          {near ? (
            <Suspense fallback={<PhoneFlat />}>
              <Phone3D />
            </Suspense>
          ) : (
            <PhoneFlat />
          )}
        </div>

        <p className="text-tx-tertiary relative -mt-1 text-center font-mono text-[9px] tracking-[0.14em] uppercase">
          Drag to turn it over
        </p>

        {/* store badges, honestly labelled */}
        <div className="relative mt-6 flex justify-center gap-2">
          {['App Store', 'Play Store'].map((s) => (
            <span
              key={s}
              className="border-st-secondary text-tx-tertiary rounded-full border bg-white px-3 py-1.5 font-mono text-[9px] tracking-[0.12em] uppercase"
            >
              {s} · soon
            </span>
          ))}
        </div>
      </div>
    </Reveal>
  )
}
