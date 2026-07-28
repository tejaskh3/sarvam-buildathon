import { useEffect, useState } from 'react'
import { Logo } from '../components/Logo'
import { API } from '../lib/api'

type Stats = {
  families: number; elders: number; sessions: number; minutes_talked: number
  memories: number; khel_rounds: number; scribe_sessions: number; photos: number
  languages: string[]
}

const LANG_NAME: Record<string, string> = {
  'hi-IN': 'Hindi', 'mr-IN': 'Marathi', 'bn-IN': 'Bengali', 'ta-IN': 'Tamil',
  'te-IN': 'Telugu', 'kn-IN': 'Kannada', 'gu-IN': 'Gujarati', 'ml-IN': 'Malayalam',
  'pa-IN': 'Punjabi', 'od-IN': 'Odia', 'en-IN': 'English',
}

export function StatsPage() {
  const [s, setS] = useState<Stats | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    const load = () =>
      fetch(`${API}/api/stats`).then((r) => r.json()).then(setS).catch(() => setErr(true))
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [])

  const Big = ({ n, label, sub }: { n: number | string; label: string; sub?: string }) => (
    <div className="border-st-secondary rounded-2xl border bg-white px-5 py-5">
      <p className="font-season text-tx text-[38px] leading-none tracking-tight">{n}</p>
      <p className="text-tx-tertiary mt-1.5 font-mono text-[9px] tracking-[0.14em] uppercase">{label}</p>
      {sub && <p className="text-tx-secondary mt-1 text-[12px] leading-snug">{sub}</p>}
    </div>
  )

  return (
    <div className="bg-sf min-h-screen">
      <header className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-5 py-4 sm:px-8">
        <a href="#top" onClick={() => (window.location.hash = '')} className="flex items-center gap-2">
          <Logo size={30} />
          <span className="font-deva text-tx text-[19px] leading-none">यादें</span>
          <span className="text-tx-tertiary text-[13px] font-medium">Yaadein · Live usage</span>
        </a>
        <a href="#/try" className="pill pill-primary !py-2 !text-[13px]">Talk to Yaadein</a>
      </header>

      <main className="mx-auto w-full max-w-[880px] px-5 pb-20 sm:px-8">
        <h1 className="font-season text-tx mt-4 text-[32px] tracking-tight">Real conversations, counted honestly</h1>
        <p className="text-tx-secondary mt-1 text-[15px]">
          Every number here comes from the live database. Nothing is seeded, nothing is a projection.
        </p>

        {err && <p className="mt-6 text-[14px] text-red-700">Could not reach the server.</p>}
        {!s ? (
          <p className="text-tx-tertiary mt-6 text-[14px]">Counting…</p>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Big n={s.families} label="Families signed up" />
              <Big n={s.elders} label="Elders talking" />
              <Big n={s.sessions} label="Voice sessions" />
              <Big n={s.minutes_talked} label="Minutes of conversation" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Big n={s.memories} label="Memories kept" sub="their own words, graded by how they were told" />
              <Big n={s.khel_rounds} label="Activity rounds" sub="proverbs, naming, songs, food, opinions" />
              <Big n={s.scribe_sessions} label="Human sessions documented" sub="recorded by a facilitator or family" />
              <Big n={s.photos} label="Family photos added" />
            </div>

            <div className="border-st-secondary mt-3 rounded-2xl border bg-white px-5 py-5">
              <p className="text-tx-tertiary font-mono text-[9px] tracking-[0.14em] uppercase">
                Languages spoken so far
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {s.languages.length ? (
                  s.languages.map((l) => (
                    <span key={l} className="bg-sr-indigo-700/10 text-sr-indigo-700 rounded-full px-3 py-1 text-[13px]">
                      {LANG_NAME[l] ?? l}
                    </span>
                  ))
                ) : (
                  <span className="text-tx-tertiary text-[13px]">No sessions yet.</span>
                )}
              </div>
              <p className="text-tx-tertiary mt-3 text-[11px]">
                Speech, understanding, memory and voice all run on Sarvam models — Saaras for listening,
                Sarvam-30B/105B for the conversation, Bulbul for the voice, and Sarvam Translate so a family can
                read their parent&apos;s memoir in English.
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
