import { personas } from '../data'
import { Reveal, Section, SectionHead, toneRing } from '../components/ui'

export function Personas() {
  return (
    <Section id="personas" tone="white">
      <SectionHead
        eyebrow="who this is for"
        title="One person does the talking. Three people have been waiting to hear it."
        lede="Memory loss doesn’t only take things from the person living with it. It takes the conversation away from everyone around them too."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {personas.map((p, i) => (
          <Reveal
            key={p.name}
            delay={i * 70}
            className="card flex flex-col p-6 transition-shadow duration-300 hover:shadow-[0_18px_44px_-30px_rgba(30,32,51,0.4)]"
          >
            <span
              className={`font-season mb-5 flex h-11 w-11 items-center justify-center rounded-full border text-[17px] ${toneRing[p.tone]}`}
            >
              {p.initials}
            </span>
            <h3 className="font-season text-tx text-[26px] leading-none">
              {p.name}, {p.age}
            </h3>
            <p className="eyebrow mt-2.5">{p.role}</p>
            <p className="text-tx-tertiary mt-4 text-[14px] leading-relaxed text-pretty">
              {p.blurb}
            </p>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}
