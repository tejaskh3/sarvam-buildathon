import { flow, pipeline } from '../data'
import { Reveal, Section, SectionHead } from '../components/ui'

export function Flow() {
  return (
    <Section id="flow">
      <SectionHead
        eyebrow="agent-initiated · elder-authored"
        title="How a session flows"
        lede="The agent carries the conversation so they never have to. It leads the floor with facts already in the store — and never leads the answer."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {flow.map((f, i) => (
          <Reveal key={f.phase} delay={i * 90} className="card flex flex-col p-7">
            <div className="border-st-secondary mb-6 flex items-baseline justify-between border-b pb-4">
              <span className="font-mono text-[10px] tracking-[0.16em]">
                {f.phase}
              </span>
              <span className="text-tx-tertiary/50 font-mono text-[10px]">
                0{i + 1}/03
              </span>
            </div>
            <h3 className="font-season text-tx mb-6 text-[27px] leading-none">
              {f.title}
            </h3>
            <ol className="space-y-4">
              {f.steps.map((s, j) => (
                <li key={j} className="flex gap-3">
                  <span className="bg-sf-secondary text-tx-tertiary mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full font-mono text-[9px]">
                    {j + 1}
                  </span>
                  <p className="text-[14px] leading-relaxed text-pretty">
                    <span className="text-tx font-medium">{s.lead}</span>{' '}
                    <span className="text-tx-tertiary">{s.rest}</span>
                  </p>
                </li>
              ))}
            </ol>
          </Reveal>
        ))}
      </div>

      {/* ------------------------------------------------------ the stack */}
      <Reveal delay={140} className="mt-6">
        <div className="border-st-secondary overflow-hidden rounded-[24px] border bg-white">
          <div className="border-st-secondary flex items-center gap-2 border-b px-6 py-3.5">
            <span className="eyebrow">the stack · Sarvam end to end</span>
          </div>
          <div className="grid divide-y divide-[var(--color-st-secondary)] md:grid-cols-5 md:divide-x md:divide-y-0">
            {pipeline.map((p, i) => (
              <div key={p.stage} className="relative p-6">
                <p className="eyebrow mb-3">{p.stage}</p>
                <p className="text-tx text-[16px] font-medium">{p.model}</p>
                <p className="text-tx-tertiary mt-1 font-mono text-[10.5px] leading-relaxed">
                  {p.detail}
                </p>
                {i < pipeline.length - 1 && (
                  <span className="text-sr-indigo-400 absolute top-1/2 -right-[9px] z-10 hidden -translate-y-1/2 bg-white px-1 text-[11px] md:block">
                    →
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal delay={200}>
        <p className="text-tx-tertiary mx-auto mt-10 max-w-2xl text-center text-[15px] leading-relaxed text-pretty">
          Selected Sarvam capability:{' '}
          <span className="text-tx font-medium">Voice Experience</span>. Depth on
          one capability beats breadth across several. Vision, Translate and
          Mayura appear only where the job genuinely needs them, and only after
          voice is solid.
        </p>
      </Reveal>
    </Section>
  )
}
