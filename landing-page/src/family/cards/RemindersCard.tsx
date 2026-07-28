import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '../../lib/auth'
import { API } from '../../lib/api'
import type { Reminder } from '../types'

/* Gentle reminders — woven into conversation, never an alarm. */

export function RemindersCard({ pid }: { pid: number }) {
  const [rows, setRows] = useState<Reminder[] | null>(null)
  const [text, setText] = useState('')
  const [when, setWhen] = useState('any')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    authFetch(`${API}/api/people/${pid}/reminders`)
      .then((r) => r.json())
      .then((j) => setRows(j.reminders ?? []))
      .catch(() => setRows([]))
  }, [pid])
  useEffect(() => { setRows(null); load() }, [pid, load])

  const add = async () => {
    if (!text.trim()) return
    setBusy(true)
    try {
      await authFetch(`${API}/api/people/${pid}/reminders`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), time_of_day: when }),
      })
      setText('')
      load()
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (r: Reminder) => {
    await authFetch(`${API}/api/reminders/${r.id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ active: r.active ? 0 : 1 }),
    })
    load()
  }

  const input = 'border-st-secondary text-tx focus:border-tx w-full rounded-lg border bg-white px-3 py-2 text-[14px] outline-none'

  return (
    <div className="border-st-secondary rounded-2xl border bg-white px-6 py-5">
      <h3 className="text-tx text-[15px] font-semibold">Things to gently remind them</h3>
      <p className="text-tx-tertiary mt-1 text-[13px] leading-relaxed">
        Yaadein brings one of these into the conversation the way a son or daughter would — once, in passing, never as
        an alarm. You&apos;ll see how often it was mentioned and how often they answered.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          placeholder="e.g. subah ki dawai nashte ke baad"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void add()}
          className={input + ' min-w-[220px] flex-1'}
        />
        <select value={when} onChange={(e) => setWhen(e.target.value)} className={input + ' w-auto'}>
          <option value="any">any time</option>
          <option value="morning">morning</option>
          <option value="afternoon">afternoon</option>
          <option value="evening">evening</option>
        </select>
        <button onClick={() => void add()} disabled={busy || !text.trim()} className="pill pill-primary !py-2 !text-[13px] disabled:opacity-40">
          Add
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {(rows ?? []).map((r) => (
          <div
            key={r.id}
            className={`flex flex-wrap items-center gap-2 rounded-xl border px-4 py-2.5 ${
              r.active ? 'border-st-secondary' : 'border-st-secondary bg-sf-secondary opacity-60'
            }`}
          >
            <span className="text-tx flex-1 text-[14px]">{r.text}</span>
            <span className="text-tx-tertiary text-[11px]">{r.time_of_day}</span>
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
                r.ack_count > 0 ? 'bg-sr-green-600/10 text-sr-green-600' : 'bg-sf-secondary text-tx-tertiary'
              }`}
              title="How many times they answered when it came up"
            >
              answered {r.ack_count}/{r.mention_count}
            </span>
            <button onClick={() => void toggle(r)} className="text-tx-tertiary hover:text-tx text-[12px] underline">
              {r.active ? 'pause' : 'resume'}
            </button>
          </div>
        ))}
        {rows && rows.length === 0 && (
          <p className="text-tx-tertiary text-[13px]">Nothing yet — medicine, water, a walk, a call to someone.</p>
        )}
      </div>
      <p className="text-tx-tertiary mt-3 text-[11px]">
        &ldquo;Answered&rdquo; means they responded warmly when it came up — not proof the medicine was taken.
      </p>
    </div>
  )
}
