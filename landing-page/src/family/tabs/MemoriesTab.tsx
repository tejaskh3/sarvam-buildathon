import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '../../lib/auth'
import { API } from '../../lib/api'
import type { Memory } from '../types'
import { Loading } from '../ui'

/* Every memory, with its provenance and its original audio. */

const PROV_STYLE: Record<string, string> = {
  USER_STATED: 'bg-sr-green-600/10 text-sr-green-600',
  USER_CONFIRMED: 'bg-amber-500/10 text-amber-700',
  USER_ELABORATED: 'bg-sky-500/10 text-sky-700',
  USER_CORRECTED: 'bg-sr-purple-600/10 text-sr-purple-600',
  FAMILY_VERIFIED: 'bg-sr-green-600/15 text-sr-green-600',
  SESSION_OBSERVED: 'bg-teal-500/10 text-teal-700',
}

export function MemoriesTab({ pid }: { pid: number }) {
  const [mems, setMems] = useState<Memory[] | null>(null)
  const [loop, setLoop] = useState<string | null>(null)

  const load = useCallback(() => {
    authFetch(`${API}/api/people/${pid}/memories`)
      .then((r) => r.json())
      .then((j) => {
        setMems(j.memories)
        setLoop(j.open_loop?.topic ?? null)
      })
  }, [pid])
  useEffect(() => { setMems(null); load() }, [pid, load])

  const act = async (url: string, body: object) => {
    await authFetch(`${API}${url}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    load()
  }

  if (!mems) return <Loading text="Loading memories…" />

  return (
    <div className="space-y-3">
      {loop && (
        <div className="border-sr-indigo-700/30 bg-sr-indigo-700/5 rounded-xl border px-4 py-3 text-[14px]">
          🧵 <b>Unfinished story:</b> {loop}
          <span className="text-tx-tertiary"> — Yaadein will reopen it by name next session</span>
        </div>
      )}
      {mems.map((m) => {
        const dim = m.status === 'SUPERSEDED'
        return (
          <div
            key={m.id}
            className={`rounded-xl border bg-white px-4 py-3.5 ${
              m.status === 'UNRESOLVED' ? 'border-amber-400'
              : m.safe_to_use === 0 ? 'border-red-300 bg-red-50/40'
              : 'border-st-secondary'
            } ${dim ? 'opacity-55' : ''}`}
          >
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <Chip className={PROV_STYLE[m.provenance] ?? 'bg-sf-secondary text-tx-tertiary'}>{m.provenance.replace('USER_', '')}</Chip>
              {m.status !== 'ACTIVE' && (
                <Chip className={m.status === 'UNRESOLVED' ? 'bg-amber-500/15 text-amber-700' : 'bg-sf-secondary text-tx-tertiary'}>
                  {m.status === 'UNRESOLVED' ? 'CONFLICTING — family decides' : 'SUPERSEDED'}
                </Chip>
              )}
              {m.safe_to_use === 0 && <Chip className="bg-red-500/10 text-red-700">AVOIDED — agent cannot see this</Chip>}
              <span className="text-tx-tertiary ml-auto text-[11px]">{m.category} · {m.emotional_tone}</span>
            </div>
            <p className={`text-tx text-[15px] leading-relaxed ${dim ? 'line-through' : ''}`}>{m.statement}</p>
            {m.canonical && <p className="text-tx-tertiary mt-0.5 text-[12px]">{m.canonical}</p>}

            {m.variants.map((v) => (
              <div key={v.id} className="mt-2 border-l-2 border-amber-400 pl-3 text-[13px]">
                <span className="text-tx-secondary">they also said: “{v.statement}”</span>
                {m.status === 'UNRESOLVED' && (
                  <button onClick={() => act(`/api/memories/${m.id}/resolve`, { keep: v.id })} className="text-sr-indigo-700 ml-2 text-[12px] underline">
                    this one is right
                  </button>
                )}
              </div>
            ))}

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {m.audio_file && (
                <button
                  onClick={() => new Audio(`${API}/api/audio/${m.audio_file}`).play()}
                  className="border-st-secondary text-tx-secondary hover:border-tx rounded-full border bg-white px-3 py-1 text-[11px]"
                >
                  ▶ why did Yaadein say this?
                </button>
              )}
              {m.status === 'UNRESOLVED' && (
                <button onClick={() => act(`/api/memories/${m.id}/resolve`, { keep: 'original' })} className="text-sr-indigo-700 text-[12px] underline">
                  original is right
                </button>
              )}
              {m.status === 'ACTIVE' && (
                <button
                  onClick={() => act(`/api/memories/${m.id}/policy`, { avoid: m.safe_to_use !== 0 })}
                  className={`rounded-full border px-3 py-1 text-[11px] ${m.safe_to_use === 0 ? 'border-st-secondary text-tx-secondary' : 'border-red-300 text-red-700'}`}
                >
                  {m.safe_to_use === 0 ? 'allow this topic again' : 'avoid this topic'}
                </button>
              )}
            </div>
          </div>
        )
      })}
      {!mems.length && <p className="text-tx-tertiary text-[14px]">No memories yet.</p>}
    </div>
  )
}

function Chip({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-[0.08em] ${className}`}>{children}</span>
}
