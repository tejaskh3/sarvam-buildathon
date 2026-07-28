import { Reveal, Section, SectionHead } from '../components/Primitives'

/* About us — Tejas's copy, verbatim. The four principles get cards;
   everything else is quiet long-form prose. */

const principles = [
  {
    name: 'Remember',
    body: 'We build a real, structured picture of a person’s life — not a pile of chat logs. People, places, relationships, and the threads between them.',
  },
  {
    name: 'Retrieve',
    body: 'When a memory is out of reach, we offer a hint, never the answer. “Wasn’t there a doctor in the family?” is a doorway. “Your son Akash is a doctor” is a closed door. The reaching matters more than the fact.',
  },
  {
    name: 'Reinforce',
    body: 'Important memories come back into conversation over time, spaced out naturally. Not drilled. Revisited — the way you’d return to a good story with someone you love.',
  },
  {
    name: 'Respect',
    body: 'This is the one we won’t bend on. Yaadein never tests. Never corrects. Never says “don’t you remember?” If a memory won’t come, we let it go and tell the story warmly ourselves. Nobody should have to fail a quiz in their own living room.',
  },
]

export function About() {
  return (
    <Section id="about" tone="white">
      <SectionHead
        eyebrow="about us"
        title="What we’re building"
        lede="Yaadein means “memories.” We named it that because it’s the word families already use. Not a clinical term. Just the ordinary word for the things you carry with you."
      />

      <div className="mx-auto max-w-[680px]">
        <Reveal>
          <h3 className="font-season text-tx text-[24px]">The problem</h3>
          <div className="text-tx-secondary mt-4 space-y-4 text-[16px] leading-relaxed">
            <p>
              Staying mentally engaged helps people living with dementia. Talking, remembering,
              telling stories — this kind of engagement is part of good care.
            </p>
            <p>But it’s hard to come by.</p>
            <p>
              Personalized cognitive therapy needs a trained person, sitting with one elder, for a
              real stretch of time. That’s expensive. In most of the world it’s simply unavailable.
              And even where families can find it, no one can provide it every single day.
            </p>
            <p>Meanwhile, something quieter is being lost.</p>
            <p>
              A grandmother knows the name of the street she grew up on, and what her mother
              cooked on Sundays. A grandfather knows why the family left that town in 1971. These
              aren’t in any album. They live in one person’s head, and they’re fading — often
              before anyone thought to ask.
            </p>
            <p>
              Families don’t lose these stories all at once. They lose them a little at a time, on
              ordinary days when nobody was writing anything down.
            </p>
          </div>
        </Reveal>

        <Reveal>
          <h3 className="font-season text-tx mt-12 text-[24px]">What Yaadein does</h3>
          <div className="text-tx-secondary mt-4 space-y-4 text-[16px] leading-relaxed">
            <p>
              Yaadein is a voice companion that talks with an elder for about ten minutes a day, in
              their own language.
            </p>
            <p>
              It’s a conversation, not a session. No screens to navigate, no forms, no buttons.
              They just talk.
            </p>
            <p>
              As they talk, Yaadein listens and builds a picture of their life — the people, the
              places, the years, the small details that connect one story to another. Over the
              following days it brings those stories back into the conversation, gently, the way an
              old friend might.
            </p>
            <p>
              And it pays attention to something most systems ignore:{' '}
              <em className="text-tx">how each person remembers.</em>
            </p>
            <p>
              Some people find their way back to a memory through a song. Others through a smell, a
              name, a place, a face. Everyone is different, and everyone’s route changes over time.
              Yaadein notices what works for this particular person and uses it again tomorrow.
            </p>
            <p>That’s the difference between a chatbot with a memory and a companion.</p>
            <p className="font-season text-tx text-[19px]">
              Yaadein doesn’t just remember for you. It learns how you remember.
            </p>
          </div>
        </Reveal>
      </div>

      <Reveal>
        <h3 className="font-season text-tx mt-14 text-center text-[24px]">
          What we hold ourselves to
        </h3>
        <p className="text-tx-secondary mt-2 text-center text-[15px]">
          Four principles. Every feature has to pass all four.
        </p>
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {principles.map((p, i) => (
            <Reveal
              key={p.name}
              delay={i * 60}
              className="border-st-secondary rounded-2xl border bg-white px-6 py-5"
            >
              <p className="text-sr-indigo-700 font-mono text-[10px] tracking-[0.16em] uppercase">
                0{i + 1}
              </p>
              <h4 className="font-season text-tx mt-2 text-[21px]">{p.name}</h4>
              <p className="text-tx-secondary mt-2 text-[14.5px] leading-relaxed">{p.body}</p>
            </Reveal>
          ))}
        </div>
      </Reveal>

      <Reveal>
        <div className="mx-auto mt-14 max-w-[680px] text-center">
          <h3 className="font-season text-tx text-[24px]">Why we made it</h3>
          <p className="text-tx-secondary mt-4 text-[16px] leading-relaxed">
            Because a life is made of small things that were never written down.
          </p>
          <p className="font-season text-tx mt-3 text-[19px] leading-snug text-balance">
            And because the people who lived them deserve to be asked, while there’s still time to
            answer.
          </p>
        </div>
      </Reveal>
    </Section>
  )
}
