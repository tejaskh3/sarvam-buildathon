import { Reveal } from '../components/ui'
import { SessionDemo } from './SessionDemo'

const stats = [
  { value: 'One orb', label: 'the entire interface' },
  { value: 'Any Indian language', label: 'however they speak at home' },
  { value: '10 min', label: 'a day, hands-free' },
  { value: 'Every day', label: 'picking up where it stopped' },
]

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      {/* soft indigo wash, in Sarvam's hero manner */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[560px]"
        style={{
          background:
            'radial-gradient(120% 70% at 50% -10%, #d5e2ff 0%, rgba(213,226,255,0.35) 38%, rgba(245,245,243,0) 72%)',
        }}
      />

      <div className="relative mx-auto w-full max-w-[1180px] px-5 pt-16 pb-20 sm:px-8 sm:pt-24 sm:pb-28">
        <Reveal className="mx-auto max-w-3xl text-center">
          <span className="border-st-secondary text-tx-secondary inline-flex items-center gap-2 rounded-full border bg-white/80 px-3.5 py-1.5 font-mono text-[10px] tracking-[0.14em] uppercase backdrop-blur">
            <span className="bg-sr-green-600 h-1.5 w-1.5 rounded-full" />
            A voice companion for elders living with memory loss
          </span>

          <h1 className="font-season text-tx mt-8 text-[56px] leading-none tracking-[-0.02em] sm:text-[74px]">
            Yaadein
          </h1>

          <h2 className="font-season text-tx mt-7 text-[38px] leading-[1.05] tracking-[-0.015em] text-balance sm:text-[58px]">
            Someone to talk to who{' '}
            <em className="text-sr-indigo-700 not-italic">
              remembers yesterday
            </em>{' '}
            — and gently notices what you remember too.
          </h2>

          <p className="text-tx-secondary mx-auto mt-7 max-w-2xl text-[17px] leading-relaxed text-pretty sm:text-[18px]">
            Tap the orb and talk. It asks your name and where you live. A few
            days later it says{' '}
            <span className="text-tx">
              “you mentioned you live in Pune — what do you like about Pune?”
            </span>{' '}
            and the conversation carries on where it left off.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-2.5">
            <a href="#/try" className="pill pill-primary">
              Talk to Yaadein
              <Arrow />
            </a>
            <a href="#loop" className="pill pill-ghost">
              See how we remember
            </a>
          </div>
        </Reveal>

        <Reveal delay={120} className="mt-16">
          <SessionDemo />
        </Reveal>

        <Reveal delay={200}>
          <dl className="border-st-secondary mt-14 grid grid-cols-2 gap-y-8 border-t pt-10 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="px-2 text-center">
                <dt className="font-season text-tx text-[26px] leading-tight text-balance">
                  {s.value}
                </dt>
                <dd className="eyebrow mt-2">{s.label}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  )
}

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
