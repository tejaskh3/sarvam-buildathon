import { Reveal, Section, SectionHead } from '../components/ui'

const outputs = [
  {
    who: 'Arjun',
    what: 'Pre-visit briefing',
    ref: 'D1',
    lines: [
      'Ask about: the mango tree in the Kolhapur courtyard',
      'She’ll want to finish: Vinayak’s blue scooter',
      'Avoid today: her brother’s illness (auto-demoted 21 Jul)',
      'New this week: she made mango pickle every summer',
    ],
    foot: 'Reads in under 60 seconds. Every line derived from a provenanced memory.',
  },
  {
    who: 'Meena',
    what: 'Something you didn’t know',
    ref: 'D2',
    lines: [
      '“Meena climbed that tree in a red frock.”',
      'First disclosed 26 Jul · USER_ELABORATED · audio 01:07.2',
      '1 conflict awaiting you: how many children?',
    ],
    foot: 'Her original audio plays inline. A relationship, not a monitoring tool.',
  },
  {
    who: 'Latha',
    what: 'Coordinator digest',
    ref: 'E2 · E4',
    lines: [
      '34 sessions ran · 31 passed all six contract lines',
      '2 flagged: engagement drop (Room 12), distress pivot (Room 4)',
      '1 disputed fact awaiting family',
    ],
    foot: 'Clean sessions require no review at all. Only the exceptions reach her.',
  },
]

export function Coverage() {
  return (
    <Section id="coverage" tone="white">
      <SectionHead
        eyebrow="job-to-be-done 2.5× · impact 1.5×"
        title="Six of forty residents get a personalized session today."
        lede="Because prep costs Latha 35 minutes each, and she has about ten hours a week. Zero prep is how six becomes thirty-four."
      />

      {/* the number */}
      <Reveal className="border-st-secondary mb-4 grid gap-px overflow-hidden rounded-[24px] border bg-[var(--color-st-secondary)] sm:grid-cols-3">
        {[
          { v: '6 → 34', l: 'residents reached per week', sub: 'E1 · zero prep' },
          { v: '35 → 0', l: 'minutes of coordinator prep', sub: 'per session' },
          { v: '6 / 6', l: 'contract lines, pass or fail', sub: 'E2 · named, not scored' },
        ].map((s) => (
          <div key={s.l} className="bg-white px-7 py-9">
            <p className="font-season text-tx text-[44px] leading-none">{s.v}</p>
            <p className="text-tx mt-3 text-[14px] font-medium">{s.l}</p>
            <p className="eyebrow mt-1.5">{s.sub}</p>
          </div>
        ))}
      </Reveal>

      {/* what each person actually gets */}
      <div className="grid gap-4 lg:grid-cols-3">
        {outputs.map((o, i) => (
          <Reveal key={o.who} delay={i * 80} className="card flex flex-col p-6">
            <div className="mb-5 flex items-baseline justify-between">
              <span className="eyebrow">for {o.who}</span>
              <span className="text-tx-tertiary/50 font-mono text-[10px]">
                {o.ref}
              </span>
            </div>
            <h3 className="font-season text-tx mb-5 text-[24px] leading-tight">
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

      <Reveal delay={200}>
        <p className="text-tx-tertiary mx-auto mt-10 max-w-2xl text-center text-[15px] leading-relaxed text-pretty">
          Engagement is captured as speaking time, turn count, spontaneous
          elaborations and affect markers — trended for caregivers and framed as
          an observation.{' '}
          <span className="text-tx">
            Never a cognitive score, never diagnostic.
          </span>
        </p>
      </Reveal>
    </Section>
  )
}
