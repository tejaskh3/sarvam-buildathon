import { useState, useEffect, useRef, useCallback } from 'react'
import { authFetch } from '../../lib/auth'
import { API } from '../../lib/api'
import type { Memoir } from '../types'
import { Loading } from '../ui'

/* The living memoir, written as they talk. */

export function MemoirTab({ pid }: { pid: number }) {
  const [m, setM] = useState<Memoir | null>(null)
  const [lang, setLang] = useState<'original' | 'en'>('original')
  const [loading, setLoading] = useState(false)
  const [narrating, setNarrating] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const load = useCallback((withEnglish: boolean) => {
    setLoading(true)
    authFetch(`${API}/api/people/${pid}/memoir${withEnglish ? '?lang=en-IN' : ''}`)
      .then((r) => r.json())
      .then(setM)
      .finally(() => setLoading(false))
  }, [pid])

  useEffect(() => {
    setM(null)
    setLang('original')
    load(false)
  }, [pid, load])

  const narrate = async () => {
    if (!m) return
    setNarrating(true)
    try {
      const text = m.paragraphs.map((p) => p.text).join(' ')
      const r = await authFetch(`${API}/api/narrate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const j = await r.json()
      audioRef.current?.pause()
      audioRef.current = new Audio('data:audio/wav;base64,' + j.audio)
      await audioRef.current.play()
    } finally {
      setNarrating(false)
    }
  }

  if (loading && !m) return <Loading text="Writing the chapter from their own words…" />
  if (!m || !m.paragraphs?.length)
    return <p className="text-tx-tertiary text-[14px]">Not enough memories for a chapter yet.</p>

  return (
    <div className="border-st-secondary rounded-2xl border bg-white px-6 py-6 sm:px-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-season text-tx text-[24px]">{lang === 'en' && m.title_translated ? m.title_translated : m.title}</h2>
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (lang === 'original') {
                if (!m.paragraphs[0]?.translated) load(true)
                setLang('en')
              } else setLang('original')
            }}
            className="pill pill-ghost !py-1.5 !text-[12px]"
          >
            {lang === 'original' ? 'Read in English' : 'मूल भाषा में पढ़ें'}
          </button>
          <button onClick={narrate} disabled={narrating} className="pill pill-primary !py-1.5 !text-[12px]">
            {narrating ? 'Preparing…' : '▶ Listen'}
          </button>
        </div>
      </div>

      {loading && <Loading text="Translating…" />}
      {m.paragraphs.map((p, i) => (
        <p key={i} className="text-tx mb-5 text-[16px] leading-[1.9]">
          {lang === 'en' && p.translated ? p.translated : p.text}
          <span className="ml-2 inline-flex gap-1 align-middle">
            {p.source_memories.map((s) =>
              s.audio_file ? (
                <button
                  key={s.id}
                  title={s.statement}
                  onClick={() => new Audio(`${API}/api/audio/${s.audio_file}`).play()}
                  className="border-st-secondary text-tx-tertiary hover:border-sr-indigo-700 hover:text-sr-indigo-700 rounded-full border bg-white px-2 py-0.5 text-[10px]"
                >
                  ▶ source
                </button>
              ) : (
                <span key={s.id} title={s.statement} className="border-st-secondary text-tx-tertiary rounded-full border px-2 py-0.5 text-[10px]">
                  ✓ source
                </span>
              ),
            )}
          </span>
        </p>
      ))}
      <p className="text-tx-tertiary text-[12px]">
        Every paragraph cites the recorded statement it came from. Nothing is invented.
      </p>
    </div>
  )
}
