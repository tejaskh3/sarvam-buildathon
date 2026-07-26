import { loop } from '../data'
import { Reveal, Section, SectionHead } from '../components/ui'

export function Loop() {
  return (
    <Section id="loop" tone="ink">
      <SectionHead
        invert
        eyebrow="the whole idea"
        title="Ask. Remember. Come back. Notice."
        lede="Most days there is nobody to talk to, and the talking is the thing that helps. Yaadein turns those ten minutes into a conversation that continues — and, quietly, into the first honest picture the family has of how things are going."
      />

      <div className="grid gap-px overflow-hidden rounded-[24px] bg-white/10 sm:grid-cols-2">
        {loop.map((l, i) => (
          <Reveal
            key={l.step}
            delay={i * 70}
            className="bg-tx flex min-h-[240px] flex-col justify-between p-8"
          >
            <span className="text-sr-indigo-300 font-mono text-[10px] tracking-[0.14em]">
              0{i + 1}
            </span>
            <div>
              <h3 className="font-season mb-4 text-[27px] leading-none text-white">
                {l.step}
              </h3>
              <p className="font-season mb-4 text-[19px] leading-snug text-white/85">
                {l.line}
              </p>
              <p className="text-[14px] leading-relaxed text-white/50 text-pretty">
                {l.body}
              </p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={200}>
        <p className="mx-auto mt-10 max-w-2xl text-center text-[15px] leading-relaxed text-white/45 text-pretty">
          Nobody is ever quizzed.{' '}
          <span className="text-white/80">
            The only question asked twice is one they enjoyed answering
          </span>{' '}
          — and if the answer doesn’t come, it is handed back like a gift, not
          marked wrong.
        </p>
      </Reveal>
    </Section>
  )
}
