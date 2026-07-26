import { rubric, shipGate } from '../data'
import { Reveal, Section, SectionHead } from '../components/ui'

const decisive = [
  {
    id: 'A9',
    title: 'Never hand them a blank floor.',
    body: 'The agent opens with a concrete proposal and every turn ends with a handhold — a binary, a yes/no, or a statement they can simply agree with.',
  },
  {
    id: 'A2',
    title: 'Then let them finish.',
    body: 'The silence window widens past five seconds when they trail off mid-clause, and tightens again after a complete thought.',
  },
  {
    id: 'C4',
    title: 'And give them the answer when it won’t come.',
    body: 'Missing recall is answered as a gift, immediately and plainly. They never sit in a moment of failure.',
  },
]

export function Done() {
  return (
    <Section id="done">
      <SectionHead
        eyebrow="definition of done"
        title="P0 is 25 stories."
        lede="If all twenty-five pass, the rubric picture looks like this."
      />

      <Reveal className="border-st-secondary overflow-hidden rounded-[24px] border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr className="border-st-secondary bg-sf/60 border-b">
                {['Parameter', 'Weight', 'Target', 'Carried by'].map((h) => (
                  <th key={h} className="eyebrow px-6 py-3.5 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-st-secondary)]">
              {rubric.map((r) => (
                <tr key={r.parameter} className="hover:bg-sf/40 transition-colors">
                  <td className="text-tx px-6 py-4 text-[15px] font-medium">
                    {r.parameter}
                  </td>
                  <td className="text-tx-secondary px-6 py-4 font-mono text-[13px]">
                    {r.weight}
                  </td>
                  <td className="px-6 py-4">
                    <span className="border-sr-green-200 bg-sr-green-50 text-sr-green-800 rounded-full border px-2.5 py-1 font-mono text-[10px] tracking-[0.1em]">
                      {r.target}
                    </span>
                  </td>
                  <td className="text-tx-tertiary px-6 py-4 font-mono text-[12px] tracking-[0.06em]">
                    {r.carried}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>

      {/* ship gate */}
      <Reveal delay={90} className="card mt-4 p-7">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <span className="eyebrow">ship gate</span>
          <p className="text-tx-secondary flex-1 text-[15px] leading-relaxed text-pretty">
            Run three full sessions on three personas in two languages, back to
            back, without touching the keyboard. If any of these fails, fix it
            before building anything on the P1 list.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap gap-1.5">
          {shipGate.map((id) => (
            <span
              key={id}
              className="border-st-secondary text-tx hover:border-tx rounded-full border bg-white px-3 py-1.5 font-mono text-[11px] tracking-[0.08em] transition-colors"
            >
              {id}
            </span>
          ))}
        </div>
      </Reveal>

      {/* the three that decide it */}
      <Reveal delay={150} className="mt-14">
        <p className="eyebrow mb-6 text-center">
          three stories decide whether this feels human
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {decisive.map((d) => (
            <div key={d.id} className="card p-7">
              <span className="text-sr-indigo-600 font-mono text-[11px] tracking-[0.1em]">
                {d.id}
              </span>
              <h3 className="font-season text-tx mt-3 mb-3 text-[24px] leading-tight text-pretty">
                {d.title}
              </h3>
              <p className="text-tx-tertiary text-[14px] leading-relaxed text-pretty">
                {d.body}
              </p>
            </div>
          ))}
        </div>
        <p className="text-tx-tertiary mx-auto mt-8 max-w-2xl text-center text-[15px] leading-relaxed text-pretty">
          The agent carries the conversation so they never have to — and{' '}
          <span className="text-tx">B7</span> is what stops it from carrying her
          story away from her.
        </p>
      </Reveal>
    </Section>
  )
}
