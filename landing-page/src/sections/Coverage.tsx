import { outputs } from '../data'
import { Reveal, Section, SectionHead } from '../components/Primitives'

export function Coverage() {
  return (
    <Section id="family" tone="white">
      <SectionHead
        eyebrow="how your loved ones can use it"
        title="The conversation doesn’t stop when the orb goes quiet."
        lede="Everything said gets turned into three small, useful things — one for the grandson who dreads the silence, one for the daughter who lives too far away, and one for the coordinator with forty residents and ten hours."
      />

      <Reveal className="mb-6 flex flex-wrap items-center gap-3">
        <span className="border-sr-pink-200 bg-sr-pink-50 text-sr-pink-800 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-[10px] tracking-[0.14em] uppercase">
          <MailIcon />
          Weekly report
        </span>
        <p className="text-tx-tertiary text-[14px] leading-relaxed">
          Sent every week to family, care-takers and the day-care centre — a
          short read, not a dashboard to log into.
        </p>
      </Reveal>

      <div className="grid gap-4 lg:grid-cols-3">
        {outputs.map((o, i) => (
          <Reveal key={o.who} delay={i * 80} className="card flex flex-col p-6">
            <div className="mb-5">
              <span className="eyebrow">for {o.who}</span>
            </div>
            <h3 className="font-season text-tx mb-5 text-[24px] leading-tight text-pretty">
              {o.what}
            </h3>
            <ul className="mb-5 flex-1 space-y-2.5">
              {o.lines.map((l, j) => (
                <li
                  key={j}
                  className="border-st-secondary bg-sf/50 text-tx-secondary rounded-[12px] border px-3.5 py-2.5 text-[13px] leading-relaxed text-pretty"
                >
                  {l}
                </li>
              ))}
            </ul>
            <p className="text-tx-tertiary text-[12.5px] leading-relaxed text-pretty">
              {o.foot}
            </p>
          </Reveal>
        ))}
      </div>

      {/* the number that matters */}
      <Reveal
        delay={140}
        className="border-st-secondary mt-4 grid gap-px overflow-hidden rounded-[24px] border bg-[var(--color-st-secondary)] sm:grid-cols-3"
      >
        {[
          {
            v: '6 → 34',
            l: 'residents who get a real conversation each week',
            sub: 'nobody has to prepare it',
          },
          {
            v: '35 → 0',
            l: 'minutes of prep before someone can talk',
            sub: 'hand over a tablet and walk away',
          },
          {
            v: 'every day',
            l: 'instead of once a fortnight',
            sub: 'the story adds up on its own',
          },
        ].map((s) => (
          <div key={s.l} className="bg-white px-7 py-9">
            <p className="font-season text-tx text-[40px] leading-none">{s.v}</p>
            <p className="text-tx mt-3 text-[14px] font-medium text-pretty">
              {s.l}
            </p>
            <p className="eyebrow mt-1.5">{s.sub}</p>
          </div>
        ))}
      </Reveal>

      <Reveal delay={200}>
        <p className="text-tx-tertiary mx-auto mt-10 max-w-2xl text-center text-[15px] leading-relaxed text-pretty">
          Whether someone spoke more this week than last, whether a name came
          back, whether a topic upset them — all of it is an observation for the
          people who love them.{' '}
          <span className="text-tx">Never a score. Never a diagnosis.</span>
        </p>
      </Reveal>
    </Section>
  )
}

function MailIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect
        x="1.5"
        y="3.5"
        width="13"
        height="9"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="m2.5 5 5.5 3.8L13.5 5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
