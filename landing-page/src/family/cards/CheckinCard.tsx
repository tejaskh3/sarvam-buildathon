import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '../../lib/auth'
import { API } from '../../lib/api'
import type { CheckinStatus } from '../types'

/* Check-ins: is she still talking? Silence is the alert. */

/* ── check-ins: is she still talking? ─────────────────────────────
   Every other panel here reports what a conversation contained. This one
   reports whether a conversation happened at all — the only signal a family
   in another city cannot get for themselves. Silence is the alert. */

const CADENCES: [number, string][] = [
  [8, 'three times a day'],
  [12, 'twice a day'],
  [24, 'once a day'],
  [48, 'every two days'],
  [72, 'every three days'],
  [168, 'once a week'],
]

/** "about 3 hours" / "2 days" — never a bare decimal at a worried reader. */
function humanGap(hours: number) {
  if (hours < 1) return 'less than an hour'
  if (hours < 24) {
    const h = Math.round(hours)
    return `${h} ${h === 1 ? 'hour' : 'hours'}`
  }
  const d = Math.floor(hours / 24)
  return `${d} ${d === 1 ? 'day' : 'days'}`
}

export function CheckinCard({ pid, name }: { pid: number; name: string }) {
  const [st, setSt] = useState<CheckinStatus | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    authFetch(`${API}/api/people/${pid}/checkin`)
      .then((r) => r.json())
      .then(setSt)
      .catch(() => setSt(null))
  }, [pid])
  useEffect(() => { setSt(null); load() }, [pid, load])

  const save = async (patch: Partial<CheckinStatus['schedule']>) => {
    if (!st) return
    setBusy(true)
    try {
      const r = await authFetch(`${API}/api/people/${pid}/checkin`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...st.schedule, ...patch }),
      })
      setSt(await r.json())
    } finally {
      setBusy(false)
    }
  }

  if (!st) return <div className="border-st-secondary text-tx-tertiary rounded-2xl border bg-white px-6 py-5 text-[13px]">Loading check-ins…</div>

  const on = st.schedule.active
  const alerts = st.events.filter((e) => e.kind === 'missed')
  const input = 'border-st-secondary text-tx focus:border-tx rounded-lg border bg-white px-3 py-2 text-[14px] outline-none'

  return (
    <div className="border-st-secondary rounded-2xl border bg-white px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-tx text-[15px] font-semibold">Let me know if they go quiet</h3>
          <p className="text-tx-tertiary mt-1 max-w-[520px] text-[13px] leading-relaxed">
            Tell us how often {name} should be talking to Yaadein. If they don&apos;t, you hear about it — that
            gap is the one thing you can&apos;t see from another city.
          </p>
        </div>
        <button
          onClick={() => void save({ active: !on })}
          disabled={busy}
          className={`pill !py-2 !text-[13px] disabled:opacity-40 ${on ? 'pill-ghost' : 'pill-primary'}`}
        >
          {on ? 'Turn off' : 'Turn on'}
        </button>
      </div>

      {on && (
        <>
          {/* the live answer to "is she alright?", stated before any controls */}
          <div
            className={`mt-4 rounded-xl border px-4 py-3.5 ${
              st.overdue ? 'border-amber-300 bg-amber-50' : 'border-sr-green-600/25 bg-sr-green-600/5'
            }`}
          >
            <p className={`text-[14px] font-medium ${st.overdue ? 'text-amber-900' : 'text-sr-green-600'}`}>
              {st.overdue
                ? `${name} hasn't talked to Yaadein for ${humanGap(st.hours_quiet)}.`
                : `${name} talked ${humanGap(st.hours_quiet)} ago.`}
            </p>
            <p className="text-tx-tertiary mt-0.5 text-[12.5px]">
              {st.overdue
                ? 'Might be worth a call yourself.'
                : `Next check-in due in about ${humanGap(st.hours_until_due)}.`}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label className="text-tx-secondary text-[13px]">They should talk</label>
            <select
              value={st.schedule.every_hours}
              onChange={(e) => void save({ every_hours: Number(e.target.value) })}
              disabled={busy}
              className={input}
            >
              {CADENCES.map(([h, label]) => (
                <option key={h} value={h}>{label}</option>
              ))}
            </select>
            <label className="text-tx-secondary ml-2 text-[13px]">Don&apos;t disturb from</label>
            <select
              value={st.schedule.quiet_from}
              onChange={(e) => void save({ quiet_from: Number(e.target.value) })}
              disabled={busy}
              className={input}
            >
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h}:00</option>)}
            </select>
            <label className="text-tx-secondary text-[13px]">to</label>
            <select
              value={st.schedule.quiet_to}
              onChange={(e) => void save({ quiet_to: Number(e.target.value) })}
              disabled={busy}
              className={input}
            >
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h}:00</option>)}
            </select>
          </div>

          <div className="mt-4 space-y-2">
            {st.events.slice(0, 6).map((e) => (
              <div key={e.id} className="border-st-secondary flex flex-wrap items-center gap-2 rounded-xl border px-4 py-2.5">
                <span
                  className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
                    e.kind === 'missed' ? 'bg-amber-100 text-amber-900'
                      : e.kind === 'resumed' ? 'bg-sr-green-600/10 text-sr-green-600'
                      : e.kind === 'dial_failed' ? 'bg-red-50 text-red-700'
                      : 'bg-sf-secondary text-tx-tertiary'
                  }`}
                >
                  {e.kind === 'missed' ? 'went quiet'
                    : e.kind === 'resumed' ? 'talking again'
                    : e.kind === 'dialled' ? 'we called'
                    : 'call failed'}
                </span>
                <span className="text-tx flex-1 text-[13.5px]">{e.detail}</span>
                <span className="text-tx-tertiary font-mono text-[11px]">{e.created_at?.slice(5, 16)}</span>
              </div>
            ))}
            {st.events.length === 0 && (
              <p className="text-tx-tertiary text-[13px]">
                Nothing to report — which is the good outcome. You&apos;ll see anything worth knowing here.
              </p>
            )}
          </div>

          {alerts.length > 0 && (
            <button
              onClick={async () => {
                await authFetch(`${API}/api/people/${pid}/checkin/ack`, { method: 'POST' })
                load()
              }}
              className="text-tx-tertiary hover:text-tx mt-3 text-[12px] underline"
            >
              Mark these as seen
            </button>
          )}

          <p className="text-tx-tertiary mt-3 text-[11px] leading-relaxed">
            {st.dialing_enabled
              ? 'Yaadein will also ring their phone to check in, never during your quiet hours.'
              : 'Alerts only for now — Yaadein does not ring their phone yet.'}
          </p>
        </>
      )}
    </div>
  )
}
