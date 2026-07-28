import { useState, useEffect } from 'react'
import { authFetch } from '../../lib/auth'
import { API } from '../../lib/api'
import type { Briefing } from '../types'
import { Loading } from '../ui'
import { CheckinCard } from '../cards/CheckinCard'
import { RemindersCard } from '../cards/RemindersCard'

/* The visit briefing — sixty seconds before you walk in — with the check-in
   above it, because "is she alright?" outranks "what should I talk about". */

function VisitBriefing({ pid }: { pid: number }) {
  const [b, setB] = useState<Briefing | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    setB(null)
    setErr(false)
    authFetch(`${API}/api/people/${pid}/briefing`)
      .then((r) => r.json())
      .then(setB)
      .catch(() => setErr(true))
  }, [pid])

  if (err) return <p className="text-tx-tertiary text-[14px]">Could not build the briefing.</p>
  if (!b) return <Loading text="Reading their week…" />

  const Row = ({ label, children, accent = false }: { label: string; children: React.ReactNode; accent?: boolean }) => (
    <div className={`grid grid-cols-1 gap-1 py-3.5 sm:grid-cols-[10rem_1fr] sm:gap-4 ${accent ? 'bg-sr-pink-50 -mx-3 rounded-lg px-3' : 'border-st-secondary border-t'}`}>
      <span className={`pt-0.5 font-mono text-[10px] tracking-[0.14em] uppercase ${accent ? 'text-sr-pink-600' : 'text-tx-tertiary'}`}>{label}</span>
      <span className="text-tx text-[15px] leading-relaxed">{children}</span>
    </div>
  )

  return (
    <div className="border-st-secondary rounded-2xl border bg-white px-6 py-5">
      <p className="text-tx-tertiary mb-2 text-[13px]">Sixty seconds, before you walk in:</p>
      {b.ask_about.map((a, i) => <Row key={i} label="Ask about">{a}</Row>)}
      {b.wants_to_finish && <Row label="They'll want to finish">{b.wants_to_finish}</Row>}
      {b.avoid_today.map((a, i) => <Row key={`av${i}`} label="Gently avoid">{a}</Row>)}
      {b.new_this_week && <Row label="Nobody knew this" accent>{b.new_this_week}</Row>}
      {!b.ask_about.length && !b.wants_to_finish && !b.new_this_week && (
        <p className="text-tx-tertiary text-[14px]">Not enough conversations yet.</p>
      )}
    </div>
  )
}

export function BriefingTab({ pid, name }: { pid: number; name: string }) {
  return (
    <div className="space-y-4">
      {/* the check-in sits above the briefing on purpose: "is she alright?"
          outranks "what should I talk to her about" */}
      <CheckinCard pid={pid} name={name} />
      <VisitBriefing pid={pid} />
      <RemindersCard pid={pid} />
    </div>
  )
}
