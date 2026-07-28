import { principles } from '../data'
import { Reveal, Section, SectionHead } from '../components/Primitives'

export function Experience() {
  return (
    <Section id="experience">
      <SectionHead
        eyebrow="how you can use it"
        title="There is nothing to learn."
        lede="The person using this may not remember what they were told five minutes ago. So there is one orb, and it does the work — every single time, without being asked."
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {principles.map((p, i) => (
          <Reveal key={p.title} delay={i * 60} className="card flex flex-col p-7">
            <span className="text-tx-tertiary/40 mb-5 font-mono text-[10px] tracking-[0.14em]">
              0{i + 1}
            </span>
            <h3 className="font-season text-tx mb-3 text-[24px] leading-tight text-pretty">
              {p.title}
            </h3>
            <p className="text-tx-tertiary text-[14px] leading-relaxed text-pretty">
              {p.body}
            </p>
          </Reveal>
        ))}
      </div>

      <Reveal delay={200}>
        <div className="mt-10 flex flex-col items-center gap-4">
          <p className="text-tx-tertiary mx-auto max-w-2xl text-center text-[15px] leading-relaxed text-pretty">
            Ten minutes, in whichever language the words arrive in.{' '}
            <span className="text-tx">
              Hands-free from the first hello to the last goodbye.
            </span>
          </p>
          <a href="#/try" className="pill pill-primary">
            Talk to Yaadein
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path
                d="M3 11 11 3M5 3h6v6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        </div>
      </Reveal>
    </Section>
  )
}
