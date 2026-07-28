import { useState, useEffect } from 'react'
import { authFetch } from '../../lib/auth'
import { API } from '../../lib/api'
import type { Engagement, Signals } from '../types'
import { Loading } from '../ui'

/* Alerts & trends: which questions took time to answer. */

const THEME_LABEL: Record<string, string> = {
  kahavat: 'Proverbs & stories',
  shabd_bazaar: 'Word bazaar (naming)',
  swad: 'Tastes & festivals',
  duniya: 'The world & opinions',
  sangeet: 'Songs & singers',
}

export function SignalsTab({ pid }: { pid: number }) {
  const [s, setS] = useState<Signals | null>(null)
  const [eng, setEng] = useState<Engagement | null>(null)
  useEffect(() => {
    setS(null)
    setEng(null)
    authFetch(`${API}/api/people/${pid}/signals`)
      .then((r) => r.json())
      .then(setS)
      .catch(() => setS({ alerts: [], fading: [], series: [], thresholds: { slow_ms: 4000, very_slow_ms: 7000 } }))
    authFetch(`${API}/api/people/${pid}/engagement`)
      .then((r) => r.json())
      .then(setEng)
      .catch(() => setEng({ rounds: [], fluency_trend: [] }))
  }, [pid])

  if (!s) return <Loading text="Reading the conversation signals…" />

  const fmtS = (ms: number) => `${(ms / 1000).toFixed(1)}s`

  return (
    <div className="space-y-6">
      {/* alerts: questions that took time to answer */}
      <div className="border-st-secondary rounded-2xl border bg-white px-6 py-5">
        <h3 className="text-tx text-[15px] font-semibold">Questions that took time to answer</h3>
        <p className="text-tx-tertiary mt-1 text-[13px]">
          Measured from the moment Yaadein finished asking to their first word. A long pause can mean the
          question was hard — bring these topics up gently, or let them rest.
        </p>
        <div className="mt-4 space-y-2.5">
          {s.alerts.map((a, i) => (
            <div
              key={i}
              className={`rounded-xl border px-4 py-3 ${
                a.severity === 'high' ? 'border-red-300 bg-red-50/50' : 'border-amber-300 bg-amber-50/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold ${
                  a.severity === 'high' ? 'bg-red-500/10 text-red-700' : 'bg-amber-500/15 text-amber-700'
                }`}>
                  {fmtS(a.delay_ms)} pause
                </span>
                <span className="text-tx-tertiary text-[11px]">{a.created_at}</span>
              </div>
              <p className="text-tx mt-1.5 text-[14px] leading-relaxed">“{a.question}”</p>
              {a.answer && <p className="text-tx-tertiary mt-0.5 text-[12px]">they answered: “{a.answer}”</p>}
            </div>
          ))}
          {!s.alerts.length && (
            <p className="text-tx-tertiary text-[14px]">No slow answers yet — every question so far came back easily.</p>
          )}
        </div>
      </div>

      {/* fading memories: trajectory slid to bare confirmation */}
      {s.fading.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-white px-6 py-5">
          <h3 className="text-tx text-[15px] font-semibold">Memories that may be getting harder</h3>
          <p className="text-tx-tertiary mt-1 text-[13px]">
            They used to tell these richly; lately they only nod along when the topic comes up.
            Worth revisiting together, with photos if you have them.
          </p>
          <ul className="mt-3 space-y-1.5">
            {s.fading.map((f) => (
              <li key={f.id} className="text-tx text-[14px] leading-relaxed">
                · {f.statement} <span className="text-tx-tertiary text-[12px]">({f.visit_count} visits)</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* CST activities + the word-fluency trend (a validated screen, played as a game) */}
      {eng && (eng.rounds.length > 0 || eng.fluency_trend.length > 0) && (
        <div className="border-st-secondary rounded-2xl border bg-white px-6 py-5">
          <h3 className="text-tx text-[15px] font-semibold">Daily activities &amp; word fluency</h3>
          <p className="text-tx-tertiary mt-1 text-[13px]">
            Yaadein plays a different game each day — proverbs, naming, songs, food, opinions — drawn from the
            cognitive stimulation protocol used in dementia clinics. Nobody is scored out loud; how many things
            they name in the naming game is recorded quietly here, because word fluency is one of the oldest
            measures of memory health.
          </p>

          {eng.fluency_trend.length > 0 && (
            <div className="mt-4">
              <p className="text-tx-tertiary font-mono text-[9px] tracking-[0.14em] uppercase">
                Things named per naming game
              </p>
              <div className="mt-2.5 flex items-end gap-2">
                {eng.fluency_trend.slice(-14).map((f) => {
                  const max = Math.max(...eng.fluency_trend.map((x) => x.items), 5)
                  return (
                    <div key={f.at} className="flex flex-1 flex-col items-center gap-1" title={`${f.at}: ${f.items} named`}>
                      <span className="text-tx-tertiary text-[10px]">{f.items}</span>
                      <div
                        className="bg-sr-green-600/60 w-full rounded-t"
                        style={{ height: `${Math.max(6, (f.items / max) * 64)}px` }}
                      />
                      <span className="text-tx-tertiary text-[9px]">{f.at.slice(5)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-1.5">
            {[...new Set(eng.rounds.map((r) => r.theme))].map((t) => (
              <span key={t} className="bg-sf-secondary text-tx-secondary rounded-full px-2.5 py-1 text-[11px]">
                {THEME_LABEL[t] ?? t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* trend graph: plan the week from how conversations are going */}
      <div className="border-st-secondary rounded-2xl border bg-white px-6 py-5">
        <h3 className="text-tx text-[15px] font-semibold">Session trends</h3>
        <p className="text-tx-tertiary mt-1 text-[13px]">
          Average pause before answering (line) and memories captured (bars), session by session.
          A rising line is your early signal to plan more support.
        </p>
        {s.series.length >= 1 ? (
          <TrendChart series={s.series} slowMs={s.thresholds.slow_ms} />
        ) : (
          <p className="text-tx-tertiary mt-4 text-[14px]">The graph appears after the first voice session.</p>
        )}
      </div>
    </div>
  )
}

function TrendChart({ series, slowMs }: { series: Signals['series']; slowMs: number }) {
  const W = 560, H = 190, PAD = { l: 40, r: 14, t: 14, b: 30 }
  const iw = W - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b
  const maxDelay = Math.max(slowMs, ...series.map((p) => p.avg_delay_ms || 0)) * 1.15
  const maxCap = Math.max(1, ...series.map((p) => p.captured))
  const x = (i: number) => PAD.l + (series.length === 1 ? iw / 2 : (i / (series.length - 1)) * iw)
  const yDelay = (ms: number) => PAD.t + ih - (ms / maxDelay) * ih
  const yCap = (c: number) => (c / maxCap) * (ih * 0.55)
  const line = series.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${yDelay(p.avg_delay_ms || 0).toFixed(1)}`).join(' ')
  const barW = Math.min(26, iw / Math.max(series.length, 1) * 0.4)

  return (
    <div className="mt-4 overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[420px]" role="img" aria-label="Session trend chart">
        {[0, 0.5, 1].map((f) => {
          const ms = maxDelay * f
          return (
            <g key={f}>
              <line x1={PAD.l} x2={W - PAD.r} y1={yDelay(ms)} y2={yDelay(ms)} stroke="#e5e3ef" strokeWidth="1" />
              <text x={PAD.l - 6} y={yDelay(ms) + 3.5} textAnchor="end" fontSize="9" fill="#8b87a3">
                {(ms / 1000).toFixed(1)}s
              </text>
            </g>
          )
        })}
        <line x1={PAD.l} x2={W - PAD.r} y1={yDelay(slowMs)} y2={yDelay(slowMs)} stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 4" />
        <text x={W - PAD.r} y={yDelay(slowMs) - 4} textAnchor="end" fontSize="9" fill="#b45309">
          hard-question line ({(slowMs / 1000).toFixed(0)}s)
        </text>
        {series.map((p, i) => (
          <rect
            key={p.session_id}
            x={x(i) - barW / 2}
            y={PAD.t + ih - yCap(p.captured)}
            width={barW}
            height={yCap(p.captured)}
            rx="3"
            fill="#6d5cf0"
            opacity="0.18"
          />
        ))}
        <path d={line} fill="none" stroke="#6d5cf0" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {series.map((p, i) => (
          <circle
            key={p.session_id}
            cx={x(i)}
            cy={yDelay(p.avg_delay_ms || 0)}
            r="3.5"
            fill={(p.avg_delay_ms || 0) >= slowMs ? '#dc2626' : '#6d5cf0'}
          >
            <title>{`${p.at} — avg pause ${((p.avg_delay_ms || 0) / 1000).toFixed(1)}s · ${p.slow_turns} slow answers · ${p.captured} memories`}</title>
          </circle>
        ))}
        {series.map((p, i) => (
          <text key={p.session_id} x={x(i)} y={H - 12} textAnchor="middle" fontSize="9" fill="#8b87a3">
            {series.length > 8 && i % 2 ? '' : p.at.slice(5, 10)}
          </text>
        ))}
        <text x={PAD.l} y={H - 2} fontSize="9" fill="#8b87a3">— avg pause before answering</text>
        <text x={PAD.l + 170} y={H - 2} fontSize="9" fill="#6d5cf0" opacity="0.7">▮ memories captured</text>
      </svg>
    </div>
  )
}
