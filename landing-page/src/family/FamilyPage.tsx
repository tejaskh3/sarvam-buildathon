import { useCallback, useEffect, useRef, useState } from 'react'
import { PhoneGate, clearStoredPhone, getStoredPhone } from '../components/PhoneGate'
import { AccountButton, RequireFamilySignIn } from '../components/Auth'
import { authFetch } from '../lib/auth'
import { Logo } from '../components/Logo'

/* ------------------------------------------------------------------
   Family Dashboard — the caregiver's side of Yaadein.
   At-a-glance insights · visit briefing · alerts & trends (which
   questions took time to answer) · the living memoir (with English
   translation and narration) · every memory with provenance and its
   original audio · photo uploads that become tomorrow's conversation.
   The elder never sees this page; their only surface is the orb.
   ------------------------------------------------------------------ */

/* ⚠ same-origin in production — never hardcode localhost (see TryPage) */
const API =
  (import.meta.env.VITE_API_BASE as string | undefined) ??
  (import.meta.env.DEV ? 'http://localhost:3000' : '')

type Person = { id: number; name: string; memory_count: number; lang: string | null }
type Memory = {
  id: number; statement: string; canonical: string; category: string
  emotional_tone: string; provenance: string; status: string; safe_to_use: number
  audio_file: string | null; created_at: string; visit_count: number
  prov_history: string | null
  variants: { id: number; statement: string; created_at: string }[]
}
type Briefing = {
  ask_about: string[]; wants_to_finish: string | null
  avoid_today: string[]; new_this_week: string | null
}
type Memoir = {
  title: string; title_translated?: string | null
  paragraphs: { text: string; translated?: string | null; source_memories: { id: number; statement: string; audio_file: string | null }[] }[]
}
type Photo = {
  id: number; url: string; event: string; place: string; year: string
  status: string; people: { name: string; relation?: string; deceased: boolean }[]
}
type Reminder = {
  id: number; text: string; time_of_day: string; active: number
  mention_count: number; ack_count: number
}
type ScribeReport = {
  summary: string; mood: string; topics: string[]
  recall_moments: { type: 'fluent' | 'needed_help'; quote: string }[]
  red_flags: string[]; for_doctor: string
  duration_min?: number; language?: string | null
}
type ScribeRow = {
  id: string; facilitator: string | null; status: string; seconds: number
  created_at: string; report: ScribeReport | null
}
type Engagement = {
  rounds: { theme: string; detail: string; items: number | null; enjoyed: number | null; created_at: string }[]
  fluency_trend: { at: string; items: number }[]
}
type Signals = {
  alerts: { question: string; answer: string; delay_ms: number; created_at: string; severity: 'high' | 'medium' }[]
  fading: { id: number; statement: string; canonical: string; visit_count: number }[]
  series: { session_id: string; at: string; turns: number; avg_delay_ms: number; max_delay_ms: number; slow_turns: number; captured: number }[]
  thresholds: { slow_ms: number; very_slow_ms: number }
}

const PROV_STYLE: Record<string, string> = {
  USER_STATED: 'bg-sr-green-600/10 text-sr-green-600',
  USER_CONFIRMED: 'bg-amber-500/10 text-amber-700',
  USER_ELABORATED: 'bg-sky-500/10 text-sky-700',
  USER_CORRECTED: 'bg-sr-purple-600/10 text-sr-purple-600',
  FAMILY_VERIFIED: 'bg-sr-green-600/15 text-sr-green-600',
  SESSION_OBSERVED: 'bg-teal-500/10 text-teal-700',
}

export function FamilyPage() {
  const [people, setPeople] = useState<Person[]>([])
  const [pid, setPid] = useState<number | null>(null)
  const [tab, setTab] = useState<'briefing' | 'signals' | 'scribe' | 'memoir' | 'memories' | 'photos'>('briefing')
  /* the family sees only the people on THEIR number — no auth, just the allowlist */
  const [phone, setPhone] = useState<string | null>(getStoredPhone)
  const [gateOpen, setGateOpen] = useState(true)

  useEffect(() => {
    if (!phone) return
    authFetch(`${API}/api/people?phone=${phone}`)
      .then((r) => {
        if (r.status === 403) {
          clearStoredPhone()
          setPhone(null)
          return []
        }
        return r.json()
      })
      .then((ps: Person[]) => {
        setPeople(ps)
        setPid(ps.length ? ps[0].id : null)
      })
      .catch(() => setPeople([]))
  }, [phone])

  return (
    <div className="bg-sf min-h-screen">
      <SignedInOnlyGate phone={phone} gateOpen={gateOpen} setPhone={setPhone} setGateOpen={setGateOpen} />
      <header className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-5 py-4 sm:px-8">
        <a href="#top" onClick={() => (window.location.hash = '')} className="flex items-center gap-2">
          <Logo size={30} />
          <span className="font-deva text-tx text-[19px] leading-none">यादें</span>
          <span className="text-tx-tertiary text-[13px] font-medium">Yaadein · Family</span>
        </a>
        <div className="flex gap-2">
          <a href="#/try" className="pill pill-ghost !py-2 !text-[13px]">Talk to Yaadein</a>
          <AccountButton />
          <a href="#top" onClick={() => (window.location.hash = '')} className="pill pill-ghost !py-2 !text-[13px]">← Site</a>
        </div>
      </header>

      <RequireFamilySignIn>
      <main className="mx-auto w-full max-w-[880px] px-5 pb-20 sm:px-8">
        <h1 className="font-season text-tx mt-4 text-[32px] tracking-tight">Before you visit</h1>
        <p className="text-tx-secondary mt-1 text-[15px]">
          Built from their own words — nothing invented. They never see this page.
        </p>

        {/* person picker */}
        <div className="mt-6 flex flex-wrap gap-2">
          {people.map((p) => (
            <button
              key={p.id}
              onClick={() => setPid(p.id)}
              className={`rounded-full border px-4 py-1.5 text-[14px] transition-colors ${
                pid === p.id
                  ? 'border-tx bg-tx text-white'
                  : 'border-st-secondary text-tx-secondary bg-white hover:border-tx'
              }`}
            >
              {p.name}
              <span className="ml-1.5 opacity-60">{p.memory_count}</span>
            </button>
          ))}
          {!people.length && phone && (
            <p className="text-tx-tertiary text-[14px]">No one yet — have a first conversation on the Try page.</p>
          )}
          {!phone && (
            <button onClick={() => setGateOpen(true)} className="pill pill-primary !py-2 !text-[13px]">
              Enter your Yaadein number
            </button>
          )}
        </div>

        {/* at a glance: numbers, moods, topics — before any tab is opened */}
        {pid !== null && <OverviewPanel pid={pid} />}

        {/* tabs */}
        {pid !== null && (
          <>
            <div className="border-st-secondary mt-8 flex flex-wrap gap-x-5 gap-y-1 border-b">
              {(
                [
                  ['briefing', 'Visit briefing'],
                  ['signals', 'Alerts & trends'],
                  ['scribe', 'Session notes'],
                  ['memoir', 'Living memoir'],
                  ['memories', 'Every memory'],
                  ['photos', 'Photos'],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`-mb-px border-b-2 pb-2.5 text-[14px] font-medium transition-colors ${
                    tab === k ? 'border-tx text-tx' : 'text-tx-tertiary border-transparent hover:text-tx'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-6">
              {tab === 'briefing' && <BriefingTabWithReminders pid={pid} />}
              {tab === 'signals' && <SignalsTab pid={pid} />}
              {tab === 'scribe' && <ScribeTab pid={pid} phone={phone} />}
              {tab === 'memoir' && <MemoirTab pid={pid} />}
              {tab === 'memories' && <MemoriesTab pid={pid} />}
              {tab === 'photos' && <PhotosTab pid={pid} />}
            </div>
          </>
        )}
      </main>
      </RequireFamilySignIn>
    </div>
  )
}

/* The number prompt belongs after sign-in — asking for a phone number on top
   of a sign-in card is two walls at once. */
function SignedInOnlyGate({
  phone, gateOpen, setPhone, setGateOpen,
}: {
  phone: string | null; gateOpen: boolean
  setPhone: (p: string | null) => void; setGateOpen: (b: boolean) => void
}) {
  if (phone || !gateOpen) return null
  return (
    <RequireFamilySignIn>
      <PhoneGate api={API} onDone={setPhone} onClose={() => setGateOpen(false)} />
    </RequireFamilySignIn>
  )
}

/* ── at a glance: the family's read on how things are going ───── */

const CAT_LABEL: Record<string, string> = {
  place: 'Places', person: 'People', food: 'Food', festival: 'Festivals',
  life_event: 'Life events', preference: 'Likes & dislikes', other: 'Other',
}

function OverviewPanel({ pid }: { pid: number }) {
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

/* ── briefing ─────────────────────────────────────────────────── */

function BriefingTab({ pid }: { pid: number }) {
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

function BriefingTabWithReminders({ pid }: { pid: number }) {
  return (
    <div className="space-y-4">
      <BriefingTab pid={pid} />
      <RemindersCard pid={pid} />
    </div>
  )
}

/* ── alerts & trends (recall-difficulty tracking) ─────────────── */

const THEME_LABEL: Record<string, string> = {
  kahavat: 'Proverbs & stories',
  shabd_bazaar: 'Word bazaar (naming)',
  swad: 'Tastes & festivals',
  duniya: 'The world & opinions',
  sangeet: 'Songs & singers',
}

function SignalsTab({ pid }: { pid: number }) {
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

/* ── gentle reminders (woven into conversation, never an alarm) ── */

function RemindersCard({ pid }: { pid: number }) {
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
        Yaadein brings one of these into the conversation the way a daughter would — once, in passing, never as
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

/* ── session notes (Scribe: record a human-run session) ───────── */

function ScribeTab({ pid, phone }: { pid: number; phone: string | null }) {
  const [rows, setRows] = useState<ScribeRow[] | null>(null)
  const [facilitator, setFacilitator] = useState('')
  const [state, setState] = useState<'idle' | 'recording' | 'finishing'>('idle')
  const [seconds, setSeconds] = useState(0)
  const [heard, setHeard] = useState<string[]>([])
  const [err, setErr] = useState<string | null>(null)
  const scribeId = useRef<string | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const bufRef = useRef<Float32Array[]>([])
  const seqRef = useRef(0)
  const recordingRef = useRef(false)

  const load = useCallback(() => {
    authFetch(`${API}/api/people/${pid}/scribe-reports`)
      .then((r) => r.json())
      .then((j) => setRows(j.reports ?? []))
      .catch(() => setRows([]))
  }, [pid])
  useEffect(() => { setRows(null); load() }, [pid, load])

  /* flush whatever is buffered as one chunk (~20s) — the server transcribes
     each chunk as it lands, so a long session never hits the 30s STT cap */
  const flush = useCallback(async () => {
    const chunks = bufRef.current
    bufRef.current = []
    if (!chunks.length || !scribeId.current) return
    const wav = encodeWavPcm(chunks, 16000)
    if (wav.size < 8000) return
    try {
      const r = await authFetch(`${API}/api/scribe/${scribeId.current}/chunk`, {
        method: 'POST',
        headers: { 'x-seq': String(seqRef.current++) },
        body: wav,
      })
      const j = await r.json()
      if (j.transcribed_seconds != null) setSeconds(j.transcribed_seconds)
      if (j.text) setHeard((h) => [...h.slice(-3), j.text])
    } catch { /* a dropped chunk must never stop the session */ }
  }, [])

  const start = async () => {
    setErr(null)
    try {
      const r = await authFetch(`${API}/api/scribe/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone, person_id: pid, facilitator }),
      })
      const j = await r.json()
      if (j.error) throw new Error(j.message || j.error)
      scribeId.current = j.scribeId
      seqRef.current = 0
      bufRef.current = []
      setSeconds(0)
      setHeard([])

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: false, noiseSuppression: true },
      })
      streamRef.current = stream
      const ctx = new AudioContext({ sampleRate: 16000 })
      ctxRef.current = ctx
      const src = ctx.createMediaStreamSource(stream)
      const proc = ctx.createScriptProcessor(4096, 1, 1)
      let framesSinceFlush = 0
      proc.onaudioprocess = (e) => {
        if (!recordingRef.current) return
        bufRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)))
        framesSinceFlush += 4096
        if (framesSinceFlush >= 16000 * 20) { // ~20s
          framesSinceFlush = 0
          void flush()
        }
      }
      src.connect(proc)
      proc.connect(ctx.destination)
      recordingRef.current = true
      setState('recording')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  const stop = async () => {
    recordingRef.current = false
    setState('finishing')
    await flush()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    void ctxRef.current?.close()
    try {
      const r = await authFetch(`${API}/api/scribe/${scribeId.current}/finish`, { method: 'POST' })
      const j = await r.json()
      if (j.error) throw new Error(j.message || j.error)
      load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setState('idle')
      scribeId.current = null
    }
  }

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
  const input = 'border-st-secondary text-tx focus:border-tx w-full rounded-lg border bg-white px-3 py-2 text-[14px] outline-none'

  return (
    <div className="space-y-6">
      <div className="border-st-secondary rounded-2xl border bg-white px-6 py-5 print:hidden">
        <h3 className="text-tx text-[15px] font-semibold">Record a session with a real person</h3>
        <p className="text-tx-tertiary mt-1 text-[13px] leading-relaxed">
          For a therapist, an activity coordinator, or a family member visiting: press start, put the phone
          down, and have your normal conversation. Yaadein listens, then writes the session note — what was
          discussed, how they seemed, what a doctor should know — and adds what it learned to their memory book.
        </p>

        {state === 'idle' ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              placeholder="Who is running this session? (e.g. Meena, activity coordinator)"
              value={facilitator}
              onChange={(e) => setFacilitator(e.target.value)}
              className={input + ' max-w-[380px] flex-1'}
            />
            <button onClick={() => void start()} className="pill pill-primary !py-2 !text-[13px]">
              ● Start recording
            </button>
          </div>
        ) : (
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-2 rounded-full bg-red-50 px-3 py-1.5">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
                <span className="font-mono text-[13px] text-red-700">{mmss(seconds)}</span>
              </span>
              <button
                onClick={() => void stop()}
                disabled={state === 'finishing'}
                className="pill pill-ghost !py-2 !text-[13px] disabled:opacity-50"
              >
                {state === 'finishing' ? 'Writing the note…' : '■ Stop & write the note'}
              </button>
              <span className="text-tx-tertiary text-[12px]">Transcribing as you talk — leave this page open.</span>
            </div>
            {heard.length > 0 && (
              <div className="bg-sf-secondary mt-3 rounded-lg px-3 py-2">
                <p className="text-tx-tertiary font-mono text-[9px] tracking-[0.14em] uppercase">Heard just now</p>
                {heard.map((h, i) => (
                  <p key={i} className="text-tx-secondary mt-1 text-[12px] leading-snug">…{h}</p>
                ))}
              </div>
            )}
          </div>
        )}
        {err && <p className="mt-3 text-[13px] text-red-700">{err}</p>}
        <p className="text-tx-tertiary mt-3 text-[11px]">
          Tell the person they are being recorded, and keep the consent form on file. Audio is transcribed and
          then only the text is kept.
        </p>
      </div>

      {!rows ? (
        <Loading text="Loading session notes…" />
      ) : rows.length === 0 ? (
        <p className="text-tx-tertiary text-[14px] print:hidden">No recorded sessions yet.</p>
      ) : (
        rows.map((row) => <ScribeCard key={row.id} row={row} />)
      )}
    </div>
  )
}

function ScribeCard({ row }: { row: ScribeRow }) {
  const r = row.report
  if (!r) {
    return (
      <div className="border-st-secondary rounded-2xl border bg-white px-6 py-4">
        <p className="text-tx-tertiary text-[13px]">
          {row.created_at} · {row.status === 'RECORDING' ? 'still recording' : 'no note written'}
        </p>
      </div>
    )
  }
  return (
    <article className="border-st-secondary rounded-2xl border bg-white px-6 py-5 print:break-inside-avoid print:border-0">
      <header className="border-st-secondary mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b pb-3">
        <div>
          <h3 className="font-season text-tx text-[19px]">Session note</h3>
          <p className="text-tx-tertiary mt-0.5 text-[12px]">
            {row.created_at} · {r.duration_min ?? Math.round(row.seconds / 60)} min
            {row.facilitator ? ` · with ${row.facilitator}` : ''}
          </p>
        </div>
        <button onClick={() => window.print()} className="pill pill-ghost !py-1.5 !text-[12px] print:hidden">
          Print for the doctor
        </button>
      </header>

      <p className="text-tx text-[15px] leading-relaxed">{r.summary}</p>

      <dl className="mt-4 space-y-3">
        {r.mood && (
          <div>
            <dt className="text-tx-tertiary font-mono text-[9px] tracking-[0.14em] uppercase">How they seemed</dt>
            <dd className="text-tx mt-0.5 text-[14px]">{r.mood}</dd>
          </div>
        )}
        {r.topics?.length > 0 && (
          <div>
            <dt className="text-tx-tertiary font-mono text-[9px] tracking-[0.14em] uppercase">Talked about</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {r.topics.map((t, i) => (
                <span key={i} className="bg-sf-secondary text-tx-secondary rounded-full px-2.5 py-1 text-[12px]">{t}</span>
              ))}
            </dd>
          </div>
        )}
        {r.recall_moments?.length > 0 && (
          <div>
            <dt className="text-tx-tertiary font-mono text-[9px] tracking-[0.14em] uppercase">In their own words</dt>
            <dd className="mt-1 space-y-1.5">
              {r.recall_moments.map((m, i) => (
                <p
                  key={i}
                  className={`border-l-2 pl-3 text-[13.5px] leading-snug ${
                    m.type === 'fluent' ? 'border-sr-green-600/60 text-tx' : 'border-amber-400 text-tx-secondary'
                  }`}
                >
                  “{m.quote}”
                  <span className="text-tx-tertiary ml-1.5 text-[11px]">
                    {m.type === 'fluent' ? 'came easily' : 'needed a hand'}
                  </span>
                </p>
              ))}
            </dd>
          </div>
        )}
        {r.red_flags?.length > 0 && (
          <div className="rounded-xl border border-amber-300 bg-amber-50/60 px-4 py-3">
            <dt className="font-mono text-[9px] tracking-[0.14em] text-amber-700 uppercase">Worth a closer look</dt>
            <dd className="mt-1">
              <ul className="space-y-1">
                {r.red_flags.map((f, i) => (
                  <li key={i} className="text-tx text-[13.5px] leading-snug">· {f}</li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        {r.for_doctor && (
          <div className="bg-sf-secondary rounded-xl px-4 py-3">
            <dt className="text-tx-tertiary font-mono text-[9px] tracking-[0.14em] uppercase">For the doctor</dt>
            <dd className="text-tx mt-1 text-[14px] leading-relaxed">{r.for_doctor}</dd>
          </div>
        )}
      </dl>
      <p className="text-tx-tertiary mt-4 text-[11px]">
        Written from the recording of this session. Observations only — not a diagnosis.
      </p>
    </article>
  )
}

/* 16kHz mono PCM16 WAV — same encoder the voice page uses */
function encodeWavPcm(chunks: Float32Array[], rate: number) {
  let len = 0
  for (const c of chunks) len += c.length
  const pcm = new Int16Array(len)
  let o = 0
  for (const c of chunks)
    for (let i = 0; i < c.length; i++) {
      const v = Math.max(-1, Math.min(1, c[i]))
      pcm[o++] = v < 0 ? v * 0x8000 : v * 0x7fff
    }
  const buf = new ArrayBuffer(44 + pcm.length * 2)
  const dv = new DataView(buf)
  const W = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i))
  }
  W(0, 'RIFF'); dv.setUint32(4, 36 + pcm.length * 2, true); W(8, 'WAVE'); W(12, 'fmt ')
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true)
  dv.setUint32(24, rate, true); dv.setUint32(28, rate * 2, true)
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true)
  W(36, 'data'); dv.setUint32(40, pcm.length * 2, true)
  new Int16Array(buf, 44).set(pcm)
  return new Blob([buf], { type: 'audio/wav' })
}

/* ── memoir ───────────────────────────────────────────────────── */

function MemoirTab({ pid }: { pid: number }) {
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

/* ── memories ─────────────────────────────────────────────────── */

function MemoriesTab({ pid }: { pid: number }) {
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

/* ── photos ───────────────────────────────────────────────────── */

function PhotosTab({ pid }: { pid: number }) {
  const [photos, setPhotos] = useState<Photo[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({ event: '', place: '', year: '', notes: '', people: '' })
  const [deceased, setDeceased] = useState('')

  const load = useCallback(() => {
    authFetch(`${API}/api/people/${pid}/photos`).then((r) => r.json()).then(setPhotos)
  }, [pid])
  useEffect(() => { setPhotos(null); load() }, [pid, load])

  const upload = async () => {
    const f = fileRef.current?.files?.[0]
    if (!f) return setMsg('Choose a photo first.')
    const names = form.people.split(',').map((x) => x.trim()).filter(Boolean)
    if (!names.length) return setMsg('List who is in the photo — Yaadein must never guess.')
    const gone = new Set(deceased.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean))
    setBusy(true)
    setMsg(null)
    try {
      // FileReader, not String.fromCharCode(...bytes): spreading a multi-MB
      // photo as arguments overflows the call stack
      const b64 = await new Promise<string>((resolve, reject) => {
        const rd = new FileReader()
        rd.onload = () => resolve((rd.result as string).split(',')[1])
        rd.onerror = () => reject(rd.error ?? new Error('Could not read the photo'))
        rd.readAsDataURL(f)
      })
      const r = await authFetch(`${API}/api/people/${pid}/photos`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          image_b64: b64,
          mime: f.type,
          event: form.event, place: form.place, year: form.year, notes: form.notes,
          people: names.map((n) => ({ name: n, deceased: gone.has(n.toLowerCase()) })),
        }),
      })
      const j = await r.json()
      if (j.error) throw new Error(j.error)
      setMsg('Uploaded — Yaadein will bring it up in the next conversation.')
      setForm({ event: '', place: '', year: '', notes: '', people: '' })
      setDeceased('')
      if (fileRef.current) fileRef.current.value = ''
      load()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const input = 'border-st-secondary text-tx w-full rounded-lg border bg-white px-3 py-2 text-[14px] outline-none focus:border-tx'

  return (
    <div className="space-y-6">
      <div className="border-st-secondary rounded-2xl border bg-white px-5 py-5">
        <h3 className="text-tx text-[15px] font-semibold">Add a photo for their next conversation</h3>
        <p className="text-tx-tertiary mt-1 text-[13px]">
          Yaadein shows it on screen, describes it aloud, and asks gentle questions with no wrong answer — using only what you write here.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png" className={input + ' sm:col-span-2'} />
          <input placeholder="What is happening? (e.g. Meena's wedding)" value={form.event} onChange={(e) => setForm({ ...form, event: e.target.value })} className={input} />
          <input placeholder="Where? (e.g. Kolhapur)" value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} className={input} />
          <input placeholder="Year (e.g. 1994)" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} className={input} />
          <input placeholder="Who is in it? (comma-separated names)" value={form.people} onChange={(e) => setForm({ ...form, people: e.target.value })} className={input} />
          <input placeholder="Of those — who has passed away? (names, or leave empty)" value={deceased} onChange={(e) => setDeceased(e.target.value)} className={input + ' sm:col-span-2'} />
          <textarea placeholder="Anything else the family remembers about this moment" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={input + ' sm:col-span-2'} rows={2} />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button onClick={upload} disabled={busy} className="pill pill-primary !py-2 !text-[13px]">
            {busy ? 'Uploading…' : 'Add photo'}
          </button>
          {msg && <span className="text-tx-secondary text-[13px]">{msg}</span>}
        </div>
        <p className="text-tx-tertiary mt-3 text-[11px]">
          The passed-away question is required so Yaadein never cheerfully asks about someone who is gone.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {(photos ?? []).map((p) => (
          <div key={p.id} className="border-st-secondary overflow-hidden rounded-2xl border bg-white">
            <img src={`${API}${p.url}`} alt={p.event} className="aspect-[4/3] w-full object-cover" />
            <div className="px-4 py-3">
              <p className="text-tx text-[14px] font-medium">{p.event || 'Untitled'} {p.year && <span className="text-tx-tertiary">· {p.year}</span>}</p>
              <p className="text-tx-tertiary mt-0.5 text-[12px]">
                {p.people.map((x) => x.name + (x.deceased ? ' †' : '')).join(', ')}
              </p>
              <span className={`mt-2 inline-block rounded-full px-2 py-0.5 font-mono text-[9px] tracking-[0.1em] ${p.status === 'NEW' ? 'bg-sr-indigo-700/10 text-sr-indigo-700' : 'bg-sf-secondary text-tx-tertiary'}`}>
                {p.status === 'NEW' ? 'WILL COME UP NEXT SESSION' : 'DISCUSSED'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── bits ─────────────────────────────────────────────────────── */

function Chip({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-[0.08em] ${className}`}>{children}</span>
}

function Loading({ text }: { text: string }) {
  return (
    <p className="text-tx-tertiary flex items-center gap-2 py-6 text-[14px]">
      <span className="bg-sr-indigo-700 h-1.5 w-1.5 animate-pulse rounded-full" />
      {text}
    </p>
  )
}
