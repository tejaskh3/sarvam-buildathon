import { Reveal } from '../components/ui'
import { SessionDemo } from './SessionDemo'

const stats = [
  { value: '37', label: 'user stories' },
  { value: '25', label: 'at P0' },
  { value: '6', label: 'contract lines' },
  { value: '10 min', label: 'per session' },
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
            Sarvam Buildathon · Voice Experience
          </span>

          <h1 className="font-deva text-tx mt-7 text-[62px] leading-none tracking-tight sm:text-[86px]">
            यादें
          </h1>
          <p className="text-tx-tertiary mt-1 font-mono text-[11px] tracking-[0.3em] uppercase">
            Yaadein
          </p>

          <h2 className="font-season text-tx mt-7 text-[38px] leading-[1.05] tracking-[-0.015em] text-balance sm:text-[60px]">
            A voice companion that learns an elder’s life story{' '}
            <em className="text-sr-indigo-700 not-italic">in their own language</em>{' '}
            — and turns it into something their family can use on Sunday.
          </h2>

          <p className="text-tx-secondary mx-auto mt-7 max-w-2xl text-[17px] leading-relaxed text-pretty sm:text-[18px]">
            The agent carries the conversation so they never have to. It leads the
            floor with facts already in the store — and never leads the answer.
            <span className="text-tx-tertiary">
              {' '}
              Agent-initiated, elder-authored.
            </span>
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-2.5">
            <a href="#/try" className="pill pill-primary">
              Try Yaadein live
              <Arrow />
            </a>
            <a href="#demo" className="pill pill-ghost">
              Watch a 10-minute session
            </a>
          </div>
        </Reveal>

        <Reveal delay={120} className="mt-16">
          <SessionDemo />
        </Reveal>

        <Reveal delay={200}>
          <dl className="border-st-secondary mt-14 grid grid-cols-2 gap-y-8 border-t pt-10 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <dt className="font-season text-tx text-[34px] leading-none">
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
