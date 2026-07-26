import { provenance } from '../data'
import { Reveal, Section, SectionHead, toneRing } from '../components/ui'

const safety = [
  {
    title: 'A closed door stays closed',
    body: '“I don’t want to talk about that” is accepted in one line. No “why?”, no retry. The topic is demoted in the policy engine and never raised autonomously again.',
    ref: 'C1',
  },
  {
    title: 'Enforced in retrieval, not in a prompt',
    body: 'ENCOURAGED → NEUTRAL → ASK_PERMISSION → AVOID → NEVER_MENTION. The last two are filtered at the retrieval layer, so the model never sees them at all.',
    ref: 'C3',
  },
  {
    title: 'Give the answer, never test',
    body: 'Missing recall is answered immediately and plainly. No hint-laddering, no “take your time”, no scoring, no correcting a wrong answer. Errorless by construction.',
    ref: 'C4',
  },
  {
    title: 'Never say what we know is false',
    body: 'Suggestibility is elevated in dementia — a confident falsehood gets adopted, not caught. A deliberate falsehood spoken by the agent fails the SAFE line outright.',
    ref: 'C6',
  },
]

export function Integrity() {
  return (
    <Section id="integrity">
      <SectionHead
        eyebrow="memory & context · safety floor"
        title="Memory demonstrated, not claimed."
        lede="Every fact is traceable to the second of audio it came from — and graded by how they gave it to us. An agent that talks more must be held to a stricter standard of evidence."
      />

      <div className="grid items-start gap-4 lg:grid-cols-[1.1fr_1fr]">
        {/* provenance ladder */}
        <Reveal className="card overflow-hidden">
          <div className="border-st-secondary flex items-center justify-between border-b px-6 py-4">
            <span className="eyebrow">provenance grades</span>
            <span className="text-tx-tertiary/60 font-mono text-[10px]">
              required field
            </span>
          </div>
          <ul className="divide-y divide-[var(--color-st-secondary)]">
            {provenance.map((p) => (
              <li
                key={p.grade}
                className="hover:bg-sf/60 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-6 py-3.5 transition-colors"
              >
                <span
                  className={`rounded-full border px-2.5 py-1 font-mono text-[9.5px] tracking-[0.1em] ${toneRing[p.tone]}`}
                >
                  {p.grade}
                </span>
                <span className="text-tx-tertiary flex-1 text-[13.5px] leading-relaxed text-pretty">
                  {p.note}
                </span>
              </li>
            ))}
          </ul>
          <div className="border-st-secondary bg-sf/50 border-t px-6 py-4">
            <p className="text-tx-tertiary text-[13px] leading-relaxed text-pretty">
              Because the agent leads, most turns are now assent. Storing those
              as <span className="font-mono text-[12px]">USER_STATED</span>{' '}
              corrupts the record within three sessions — so bare agreement
              stays a candidate until something independent corroborates it.
              <span className="text-tx"> That’s story B7.</span>
            </p>
          </div>
        </Reveal>

        {/* variance panel + safety */}
        <div className="grid gap-4">
          <Reveal delay={80} className="card p-7">
            <span className="eyebrow">B8 · B9</span>
            <h3 className="font-season text-tx mt-3 mb-4 text-[27px] leading-tight">
              Different answers aren’t a defect.
            </h3>
            <div className="border-st-secondary mb-4 space-y-2 rounded-[16px] border border-dashed p-4">
              {[
                { d: '14 Jul', v: 'two children', tone: 'text-tx-tertiary' },
                { d: '21 Jul', v: 'three children', tone: 'text-tx-tertiary' },
                { d: '26 Jul', v: 'four children', tone: 'text-tx' },
              ].map((r) => (
                <div key={r.d} className="flex items-center gap-3">
                  <span className="text-tx-tertiary/60 w-14 font-mono text-[10px]">
                    {r.d}
                  </span>
                  <span className={`flex-1 text-[14px] ${r.tone}`}>{r.v}</span>
                  <span className="text-tx-tertiary/40 font-mono text-[9px]">
                    kept
                  </span>
                </div>
              ))}
              <div className="border-st-secondary mt-3 flex items-center gap-2 border-t pt-3">
                <span className="bg-sr-rose-100 text-sr-rose-600 rounded-full px-2 py-[3px] font-mono text-[9px] tracking-[0.1em]">
                  UNRESOLVED
                </span>
                <span className="text-tx-tertiary text-[12px]">
                  blocked from the memoir · routed to Meena
                </span>
              </div>
            </div>
            <p className="text-tx-tertiary text-[14px] leading-relaxed text-pretty">
              No correction. No reaction in-session. Variance is data about what
              we don’t yet understand — it may mean a child who died, a
              stepchild, an estrangement.{' '}
              <span className="text-tx">
                They are the authority on their experience; the family is the
                authority on external fact.
              </span>
            </p>
          </Reveal>

          <Reveal delay={140} className="card p-7">
            <span className="eyebrow">delight floor · non-negotiable</span>
            <ul className="mt-5 space-y-5">
              {safety.map((s) => (
                <li key={s.ref} className="flex gap-4">
                  <span className="text-tx-tertiary/50 mt-[3px] w-5 shrink-0 font-mono text-[10px]">
                    {s.ref}
                  </span>
                  <div>
                    <p className="text-tx text-[15px] font-medium">{s.title}</p>
                    <p className="text-tx-tertiary mt-1 text-[13.5px] leading-relaxed text-pretty">
                      {s.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </Section>
  )
}
