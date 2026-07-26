import { useEffect, useRef, useState } from 'react'
import { Orb, VoiceLabel, type Voice } from '../components/Orb'

/* ------------------------------------------------------------------
   What a person actually sees and hears. One orb, a voice, and a few
   days passing between conversations.
   ------------------------------------------------------------------ */

type Turn = {
  who: 'agent' | 'person'
  text: string
  gloss: string
  /** something Yaadein now knows */
  remembers?: { label: string; value: string }
  /** the recall note for this visit */
  recall?: { visit: string; ok: boolean; note: string }
  hold?: number
}

type Visit = {
  id: string
  label: string
  when: string
  caption: string
  turns: Turn[]
}

const visits: Visit[] = [
  {
    id: 'v1',
    label: 'First conversation',
    when: 'Monday',
    caption: 'It starts by getting to know them. Nothing is assumed.',
    turns: [
      {
        who: 'agent',
        text: 'Namaste. Main Yaadein hoon, aapse roz thodi der baat karne aayi hoon. Main aapko kis naam se bulaoon?',
        gloss:
          'I’m Yaadein. I’ve come to talk with you a little every day. What should I call you?',
      },
      {
        who: 'person',
        text: 'Kamala. Kamala Deshpande.',
        gloss: 'Kamala. Kamala Deshpande.',
        remembers: { label: 'Name', value: 'Kamala Deshpande' },
      },
      {
        who: 'agent',
        text: 'Kamala ji. Aur aap rehte kahan hain?',
        gloss: 'Kamala ji. And where do you live?',
      },
      {
        who: 'person',
        text: 'Pune mein. Kothrud.',
        gloss: 'In Pune. Kothrud.',
        remembers: { label: 'Lives in', value: 'Pune · Kothrud' },
        hold: 3000,
      },
    ],
  },
  {
    id: 'v4',
    label: 'Four days later',
    when: 'Thursday',
    caption:
      'It opens where the last conversation stopped — and quietly notices whether the answer came back.',
    turns: [
      {
        who: 'agent',
        text: 'Kamala ji, aapne bataya tha ki aap Pune mein rehte hain. Pune mein aapko sabse achha kya lagta hai?',
        gloss:
          'Kamala ji, you mentioned you live in Pune. What do you like most about Pune?',
      },
      {
        who: 'person',
        text: 'Barish. Pune ki barish… aur Sarasbaug.',
        gloss: 'The rain. Pune’s rain… and Sarasbaug.',
        recall: {
          visit: 'Thursday',
          ok: true,
          note: 'Remembered Pune, and offered more',
        },
      },
      {
        who: 'agent',
        text: 'Sarasbaug. Wahan aap kiske saath jaate the?',
        gloss: 'Sarasbaug. Who did you use to go there with?',
      },
      {
        who: 'person',
        text: 'Mere pati ke saath. Har Sunday.',
        gloss: 'With my husband. Every Sunday.',
        remembers: { label: 'Sundays', value: 'Sarasbaug, with their husband' },
        hold: 3000,
      },
    ],
  },
  {
    id: 'v9',
    label: 'Two weeks in',
    when: 'Tuesday',
    caption:
      'When something doesn’t come back, it is simply given — never asked for twice, never corrected.',
    turns: [
      {
        who: 'agent',
        text: 'Kamala ji, aap Sunday ko kahan jaate the?',
        gloss: 'Kamala ji, where did you use to go on Sundays?',
      },
      {
        who: 'person',
        text: 'Sunday ko… hmm. Yaad nahi aa raha.',
        gloss: 'On Sundays… hmm. It isn’t coming to me.',
        recall: {
          visit: 'Tuesday',
          ok: false,
          note: 'Sarasbaug didn’t come back today',
        },
      },
      {
        who: 'agent',
        text: 'Sarasbaug. Aapne bataya tha — har Sunday, apne pati ke saath.',
        gloss: 'Sarasbaug. You told me — every Sunday, with your husband.',
      },
      {
        who: 'person',
        text: 'Haan! Sarasbaug. Wahan ganpati mandir tha.',
        gloss: 'Yes! Sarasbaug. There was a Ganpati temple there.',
        remembers: { label: 'Sarasbaug', value: 'the Ganpati temple' },
        hold: 3400,
      },
    ],
  },
]

export function SessionDemo() {
  const [vi, setVi] = useState(0)
  const [step, setStep] = useState(0)
  const [live, setLive] = useState(false)
  /* stops rolling on to the next visit once someone picks one themselves */
  const [auto, setAuto] = useState(true)
  const rootRef = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  const visit = visits[vi]
  const done = step >= visit.turns.length

  /* start only once the panel is on screen */
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !started.current) {
          started.current = true
          setLive(true)
          io.disconnect()
        }
      },
      { threshold: 0.2 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  /* advance through the visit, then roll on to the next one */
  useEffect(() => {
    if (!live) return
    if (done) {
      if (!auto) return
      const t = window.setTimeout(() => {
        setVi((v) => (v + 1) % visits.length)
        setStep(0)
      }, 2600)
      return () => window.clearTimeout(t)
    }
    const t = window.setTimeout(
      () => setStep((s) => s + 1),
      visit.turns[step]?.hold ?? 3000,
    )
    return () => window.clearTimeout(t)
  }, [live, step, done, visit, auto])

  const shown = visit.turns.slice(0, step)
  const current = shown[shown.length - 1]

  /* the orb shows whoever holds the floor right now */
  const orbState: Voice =
    !live || done || !current
      ? 'idle'
      : current.who === 'agent'
        ? 'speaking'
        : 'listening'

  /* everything learned up to and including the current visit */
  const learned = visits
    .slice(0, vi + 1)
    .flatMap((v, i) =>
      (i === vi ? v.turns.slice(0, step) : v.turns).flatMap((t) =>
        t.remembers ? [t.remembers] : [],
      ),
    )
  const recalls = visits
    .slice(0, vi + 1)
    .flatMap((v, i) =>
      (i === vi ? v.turns.slice(0, step) : v.turns).flatMap((t) =>
        t.recall ? [t.recall] : [],
      ),
    )

  const pick = (i: number) => {
    setVi(i)
    setStep(0)
    setLive(true)
    setAuto(false)
    started.current = true
  }

  return (
    <div
      ref={rootRef}
      id="demo"
      className="border-st-secondary overflow-hidden rounded-[26px] border bg-white shadow-[0_28px_70px_-40px_rgba(30,32,51,0.35)]"
    >
      {/* visit switcher */}
      <div className="border-st-secondary bg-sf-secondary/50 flex flex-wrap items-center gap-2 border-b px-4 py-3 sm:px-5">
        {visits.map((v, i) => (
          <button
            key={v.id}
            onClick={() => pick(i)}
            className={`rounded-full px-3.5 py-1.5 font-mono text-[10px] tracking-[0.1em] uppercase transition-colors ${
              i === vi
                ? 'bg-tx text-white'
                : 'text-tx-tertiary hover:text-tx bg-white'
            }`}
          >
            {v.label}
          </button>
        ))}
        <span className="text-tx-tertiary/60 ml-auto font-mono text-[10px] tracking-[0.1em]">
          {visit.when}
        </span>
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr]">
        {/* ------------------------------------------- the orb + voice */}
        <div className="border-st-secondary flex flex-col items-center border-b px-5 py-8 sm:px-8 lg:border-r lg:border-b-0">
          <Orb voice={orbState} className="w-[190px] sm:w-[220px]" />

          {/* the microphone is the only control, and the label under it
              is the only status */}
          <div
            className={`-mt-5 flex h-[54px] w-[54px] items-center justify-center rounded-full border transition-all duration-300 ${
              orbState === 'listening'
                ? 'border-sr-purple-600 bg-sr-purple-600 text-white shadow-[0_0_0_8px_rgba(109,92,240,0.13)]'
                : 'border-st-secondary text-tx-tertiary bg-white'
            }`}
          >
            <MicIcon />
          </div>

          <div className="mt-4 flex h-5 items-center">
            <VoiceLabel voice={orbState} />
          </div>

          {/* what is being said, right now */}
          <div className="mt-5 flex min-h-[168px] w-full max-w-[440px] flex-col justify-start">
            {current ? (
              <div
                key={`${visit.id}-${step}`}
                className={`reveal rounded-[18px] border px-5 py-4 ${
                  current.who === 'agent'
                    ? 'border-sr-pink-200 bg-sr-pink-50'
                    : 'border-sr-purple-200 bg-sr-purple-50'
                }`}
              >
                <p
                  className={`eyebrow mb-2 ${
                    current.who === 'agent'
                      ? '!text-sr-pink-600'
                      : '!text-sr-purple-600'
                  }`}
                >
                  {current.who === 'agent' ? 'Yaadein' : 'Kamala'}
                </p>
                <p className="text-tx text-[16px] leading-[1.55]">
                  {current.text}
                </p>
                <p className="text-tx-tertiary mt-2 text-[13px] leading-snug italic">
                  {current.gloss}
                </p>
              </div>
            ) : (
              <p className="text-tx-tertiary/60 text-center text-[14px]">
                Tap the microphone and talk. That’s the whole interface.
              </p>
            )}
          </div>

          <p className="text-tx-tertiary mt-5 max-w-[420px] text-center text-[13.5px] leading-relaxed text-pretty">
            {visit.caption}
          </p>
        </div>

        {/* -------------------------------------------------- side rail */}
        <div className="bg-sf/50 flex h-full flex-col">
          <div className="border-st-secondary border-b px-5 py-5 sm:px-6">
            <p className="eyebrow mb-3.5">What Yaadein remembers</p>
            {learned.length === 0 ? (
              <p className="text-tx-tertiary/60 text-[13px] leading-relaxed">
                Nothing yet — this is the first conversation.
              </p>
            ) : (
              <ul className="space-y-2">
                {learned.map((m, i) => (
                  <li
                    key={i}
                    className="reveal border-st-secondary flex items-baseline gap-3 rounded-[12px] border bg-white px-3.5 py-2.5"
                  >
                    <span className="text-tx-tertiary/70 w-[68px] shrink-0 font-mono text-[9.5px] tracking-[0.1em] uppercase">
                      {m.label}
                    </span>
                    <span className="text-tx flex-1 text-[13.5px] leading-snug">
                      {m.value}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex-1 px-5 py-5 sm:px-6">
            <p className="eyebrow mb-3.5">Did it come back?</p>
            {recalls.length === 0 ? (
              <p className="text-tx-tertiary/60 text-[13px] leading-relaxed">
                Nothing to check yet. Recall is only ever looked at on the way
                back to something they already told us.
              </p>
            ) : (
              <ul className="space-y-2">
                {recalls.map((r, i) => (
                  <li key={i} className="reveal flex items-start gap-2.5">
                    <span
                      className={`mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                        r.ok ? 'bg-sr-green-600' : 'bg-sr-warm-200'
                      }`}
                    >
                      {r.ok ? (
                        <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                          <path
                            d="M1.5 5.2 3.8 7.4 8.5 2.6"
                            stroke="#fff"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        <span className="bg-sr-warm-900/40 block h-[1.5px] w-2 rounded-full" />
                      )}
                    </span>
                    <span className="flex-1">
                      <span className="text-tx block text-[13.5px] leading-snug">
                        {r.note}
                      </span>
                      <span className="text-tx-tertiary/60 font-mono text-[9.5px] tracking-[0.1em] uppercase">
                        {r.visit}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <p className="text-tx-tertiary/70 mt-5 text-[12.5px] leading-relaxed text-pretty">
              Never said out loud. Never a score, never a diagnosis — just
              something the family can see changing, week to week.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function MicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}
