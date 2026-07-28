import { useState, useEffect } from 'react'
import { authFetch } from '../lib/auth'
import { API } from '../lib/api'
import type { Memory, Signals } from './types'
import { Loading } from './ui'

/* At a glance: the family's read on how things are going, before any tab is
   opened. */

const CAT_LABEL: Record<string, string> = {
  place: 'Places', person: 'People', food: 'Food', festival: 'Festivals',
  life_event: 'Life events', preference: 'Likes & dislikes', other: 'Other',
}

export function OverviewPanel({ pid }: { pid: number }) {
  const [mems, setMems] = useState<Memory[] | null>(null)
  const [loop, setLoop] = useState<string | null>(null)
  const [sig, setSig] = useState<Signals | null>(null)

  useEffect(() => {
    setMems(null)
    setSig(null)
    authFetch(`${API}/api/people/${pid}/memories`)
      .then((r) => r.json())
      .then((j) => { setMems(j.memories ?? []); setLoop(j.open_loop?.topic ?? null) })
      .catch(() => setMems([]))
    authFetch(`${API}/api/people/${pid}/signals`)
      .then((r) => r.json())
      .then(setSig)
      .catch(() => setSig(null))
  }, [pid])

  if (!mems) return <Loading text="Gathering the week…" />
  if (!mems.length) return null

  const active = mems.filter((m) => m.status === 'ACTIVE')
  const unresolved = mems.filter((m) => m.status === 'UNRESOLVED').length
  const tone = { positive: 0, neutral: 0, negative: 0 }
  const cats: Record<string, number> = {}
  const joyCats: Record<string, number> = {}
  for (const m of active) {
    tone[(m.emotional_tone as keyof typeof tone) in tone ? (m.emotional_tone as keyof typeof tone) : 'neutral']++
    cats[m.category] = (cats[m.category] ?? 0) + 1
    if (m.emotional_tone === 'positive') joyCats[m.category] = (joyCats[m.category] ?? 0) + 1
  }
  const topCats = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 4)
  const maxCat = topCats[0]?.[1] ?? 1
  const joyCat = Object.entries(joyCats).sort((a, b) => b[1] - a[1])[0]?.[0]
  const toneTotal = Math.max(1, tone.positive + tone.neutral + tone.negative)

  const series = sig?.series ?? []
  const last = series.at(-1)
  const prev = series.at(-2)
  const pauseTrend = last && prev && last.avg_delay_ms != null && prev.avg_delay_ms != null
    ? last.avg_delay_ms - prev.avg_delay_ms
    : null
  const needsYou = unresolved + (sig?.fading.length ?? 0)

  /* plain-language reads the family can act on */
  const insights: { icon: string; text: string }[] = []
  if (joyCat && CAT_LABEL[joyCat])
    insights.push({ icon: '✨', text: `${CAT_LABEL[joyCat]} bring the most joy — a good place to start a visit.` })
  if (loop)
    insights.push({ icon: '🧵', text: `There's an unfinished story: “${loop}”. Ask them to finish it.` })
  if (pauseTrend != null)
    insights.push(pauseTrend <= -300
      ? { icon: '💚', text: 'Answers came quicker last session than the one before.' }
      : pauseTrend >= 300
        ? { icon: '🕰', text: 'Answers took a little longer last session — worth a gentler pace.' }
        : { icon: '🙂', text: 'Response pace has been steady across recent sessions.' })
  if (unresolved > 0)
    insights.push({ icon: '⚖️', text: `${unresolved} ${unresolved === 1 ? 'memory has' : 'memories have'} two versions — settle ${unresolved === 1 ? 'it' : 'them'} in Every memory.` })
  if ((sig?.fading.length ?? 0) > 0)
    insights.push({ icon: '🍂', text: `${sig!.fading.length} ${sig!.fading.length === 1 ? 'memory' : 'memories'} may be getting harder — details in Alerts & trends.` })

  const Tile = ({ big, label, sub, warn = false }: { big: React.ReactNode; label: string; sub?: string; warn?: boolean }) => (
    <div className={`rounded-2xl border px-4 py-3.5 ${warn ? 'border-amber-300 bg-amber-50/60' : 'border-st-secondary bg-white'}`}>
      <p className={`text-[24px] leading-tight font-semibold tracking-tight ${warn ? 'text-amber-700' : 'text-tx'}`}>{big}</p>
      <p className="text-tx-tertiary mt-0.5 font-mono text-[9px] tracking-[0.14em] uppercase">{label}</p>
      {sub && <p className="text-tx-secondary mt-1 text-[11px] leading-snug">{sub}</p>}
    </div>
  )

  return (
    <section className="mt-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile big={active.length} label="Living memories" sub={`${mems.length - active.length} archived versions kept`} />
        <Tile big={series.length || '—'} label="Voice sessions" sub={last ? `last: ${last.at.slice(5, 10)}` : 'none yet'} />
        <Tile
          big={last?.avg_delay_ms != null ? `${(last.avg_delay_ms / 1000).toFixed(1)}s` : '—'}
          label="Avg pause, last session"
          sub={pauseTrend == null ? 'how long answers take to start' : pauseTrend <= -300 ? '↓ quicker than before' : pauseTrend >= 300 ? '↑ slower than before' : '→ steady'}
        />
        <Tile big={needsYou} label="Needs your eye" sub={needsYou ? 'conflicts + fading memories' : 'nothing pending'} warn={needsYou > 0} />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {/* what they love talking about */}
        <div className="border-st-secondary rounded-2xl border bg-white px-5 py-4">
          <p className="text-tx-tertiary font-mono text-[9px] tracking-[0.14em] uppercase">What they talk about</p>
          <div className="mt-3 space-y-2">
            {topCats.map(([cat, n]) => (
              <div key={cat} className="flex items-center gap-2.5">
                <span className="text-tx w-[104px] shrink-0 text-[12px]">{CAT_LABEL[cat] ?? cat}</span>
                <div className="bg-sf-secondary h-2 flex-1 overflow-hidden rounded-full">
                  <div className="bg-sr-purple-600/70 h-full rounded-full" style={{ width: `${(n / maxCat) * 100}%` }} />
                </div>
                <span className="text-tx-tertiary w-5 text-right text-[11px]">{n}</span>
              </div>
            ))}
          </div>
          {/* how those memories feel */}
          <p className="text-tx-tertiary mt-4 font-mono text-[9px] tracking-[0.14em] uppercase">How those memories feel</p>
          <div className="mt-2 flex h-2.5 overflow-hidden rounded-full">
            <div className="bg-sr-green-600/70" style={{ width: `${(tone.positive / toneTotal) * 100}%` }} />
            <div className="bg-sf-secondary" style={{ width: `${(tone.neutral / toneTotal) * 100}%` }} />
            <div className="bg-red-400/70" style={{ width: `${(tone.negative / toneTotal) * 100}%` }} />
          </div>
          <div className="text-tx-tertiary mt-1.5 flex gap-3 text-[11px]">
            <span><span className="text-sr-green-600">●</span> happy {tone.positive}</span>
            <span><span className="opacity-40">●</span> neutral {tone.neutral}</span>
            <span><span className="text-red-400">●</span> tender {tone.negative}</span>
          </div>
        </div>

        {/* this week, in plain words */}
        <div className="border-st-secondary rounded-2xl border bg-white px-5 py-4">
          <p className="text-tx-tertiary font-mono text-[9px] tracking-[0.14em] uppercase">Worth knowing</p>
          <ul className="mt-3 space-y-2.5">
            {insights.slice(0, 5).map((ins, i) => (
              <li key={i} className="text-tx flex gap-2 text-[13px] leading-snug">
                <span aria-hidden>{ins.icon}</span>
                <span>{ins.text}</span>
              </li>
            ))}
            {!insights.length && (
              <li className="text-tx-tertiary text-[13px]">A few more conversations and patterns will show up here.</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  )
}
