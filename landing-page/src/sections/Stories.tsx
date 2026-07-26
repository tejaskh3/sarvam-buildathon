import { useMemo, useState } from 'react'
import { allStories, epics, shipGate, type Priority } from '../data'
import {
  ContractBadge,
  PriorityTag,
  Reveal,
  Section,
  SectionHead,
} from '../components/ui'

type Filter = 'All' | Priority

export function Stories() {
  const [filter, setFilter] = useState<Filter>('P0')
  const [open, setOpen] = useState<string | null>('A9')

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: allStories.length }
    for (const s of allStories) c[s.priority] = (c[s.priority] ?? 0) + 1
    return c
  }, [])

  const shown = epics
    .map((e) => ({
      ...e,
      stories: e.stories.filter((s) => filter === 'All' || s.priority === filter),
    }))
    .filter((e) => e.stories.length > 0)

  return (
    <Section id="stories" tone="white">
      <SectionHead
        eyebrow="build spec v1 · 37 stories · 6 epics"
        title="User stories"
        lede="The whole spec, in the open. Each story is a promise to one of the four people above — with the acceptance criteria that decide whether we kept it."
      />

      <Reveal className="mb-8 flex flex-wrap items-center gap-2">
        {(['All', 'P0', 'P1', 'P2'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-4 py-1.5 font-mono text-[11px] tracking-[0.1em] transition-colors ${
              filter === f
                ? 'bg-tx border-tx text-white'
                : 'border-st-secondary text-tx-tertiary hover:border-tx hover:text-tx bg-white'
            }`}
          >
            {f}
            <span className="ml-2 opacity-50">{counts[f] ?? 0}</span>
          </button>
        ))}
        <span className="text-tx-tertiary ml-auto font-mono text-[10px] tracking-[0.1em]">
          click a story to expand
        </span>
      </Reveal>

      <div className="space-y-12">
        {shown.map((e) => (
          <Reveal key={e.key}>
            <div className="border-st-secondary mb-5 flex flex-wrap items-baseline gap-x-4 gap-y-2 border-b pb-4">
              <span className="bg-sf-secondary text-tx flex h-8 w-8 items-center justify-center rounded-full font-mono text-[12px]">
                {e.key}
              </span>
              <h3 className="font-season text-tx text-[30px] leading-none">
                {e.title}
              </h3>
              <span className="border-sr-indigo-200 bg-sr-indigo-50 text-sr-indigo-700 rounded-full border px-2.5 py-1 font-mono text-[9.5px] tracking-[0.1em]">
                {e.weightLabel}
              </span>
            </div>
            <p className="text-tx-tertiary mb-6 max-w-3xl text-[15px] leading-relaxed text-pretty">
              {e.thesis}
            </p>

            <div className="grid gap-2.5">
              {e.stories.map((s) => {
                const isOpen = open === s.id
                return (
                  <div
                    key={s.id}
                    className={`overflow-hidden rounded-[18px] border transition-colors ${
                      isOpen
                        ? 'border-tx/25 bg-sf/60'
                        : 'border-st-secondary hover:border-tx/30 bg-white'
                    }`}
                  >
                    <button
                      onClick={() => setOpen(isOpen ? null : s.id)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center gap-3 px-5 py-4 text-left"
                    >
                      <span className="text-tx-tertiary w-7 shrink-0 font-mono text-[11px]">
                        {s.id}
                      </span>
                      <PriorityTag p={s.priority} />
                      {s.badge && <ContractBadge label={s.badge} />}
                      {shipGate.includes(s.id) && (
                        <span
                          title="Ship gate"
                          className="border-sr-rose-100 bg-sr-rose-100 text-sr-rose-600 rounded-full border px-2 py-[3px] font-mono text-[8.5px] tracking-[0.1em]"
                        >
                          SHIP GATE
                        </span>
                      )}
                      <span className="text-tx flex-1 text-[15px] font-medium text-pretty">
                        {s.title}
                      </span>
                      <span
                        className={`text-tx-tertiary shrink-0 text-[13px] transition-transform duration-200 ${
                          isOpen ? 'rotate-45' : ''
                        }`}
                      >
                        +
                      </span>
                    </button>

                    {isOpen && (
                      <div className="border-st-secondary/70 grid gap-6 border-t px-5 py-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
                        <p className="text-tx-secondary text-[15px] leading-relaxed text-pretty">
                          <span className="text-tx-tertiary">As</span>{' '}
                          <span className="text-tx font-medium">{s.role}</span>
                          <span className="text-tx-tertiary">, I want</span>{' '}
                          {s.want}
                          <span className="text-tx-tertiary">, so that</span>{' '}
                          {s.so}.
                        </p>

                        <div>
                          <p className="eyebrow mb-3">Acceptance criteria</p>
                          <ul className="space-y-2.5">
                            {s.criteria.map((c, i) => (
                              <li key={i} className="flex gap-2.5">
                                <span className="bg-sr-indigo-400 mt-[7px] h-1 w-1 shrink-0 rounded-full" />
                                <span className="text-tx-tertiary text-[13.5px] leading-relaxed text-pretty">
                                  {c}
                                </span>
                              </li>
                            ))}
                          </ul>
                          {s.test && (
                            <div className="border-sr-green-200 bg-sr-green-50/60 mt-4 rounded-[12px] border px-3.5 py-3">
                              <p className="text-sr-green-800 mb-1 font-mono text-[9px] tracking-[0.14em] uppercase">
                                Test
                              </p>
                              <p className="text-sr-green-800 text-[13px] leading-relaxed">
                                {s.test}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}
