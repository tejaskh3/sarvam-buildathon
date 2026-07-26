import { useCallback, useEffect, useRef, useState } from 'react'

/* ------------------------------------------------------------------
   Family Dashboard — the caregiver's side of Yaadein.
   Briefing before a visit · the living memoir (with English translation
   and narration) · every memory with provenance and its original audio ·
   photo uploads that become tomorrow's conversation.
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

const PROV_STYLE: Record<string, string> = {
  USER_STATED: 'bg-sr-green-600/10 text-sr-green-600',
  USER_CONFIRMED: 'bg-amber-500/10 text-amber-700',
  USER_ELABORATED: 'bg-sky-500/10 text-sky-700',
  USER_CORRECTED: 'bg-sr-purple-600/10 text-sr-purple-600',
  FAMILY_VERIFIED: 'bg-sr-green-600/15 text-sr-green-600',
}

export function FamilyPage() {
  const [people, setPeople] = useState<Person[]>([])
  const [pid, setPid] = useState<number | null>(null)
  const [tab, setTab] = useState<'briefing' | 'memoir' | 'memories' | 'photos'>('briefing')

  useEffect(() => {
    fetch(`${API}/api/people`)
      .then((r) => r.json())
      .then((ps: Person[]) => {
        setPeople(ps)
        if (ps.length) setPid(ps[0].id)
      })
      .catch(() => setPeople([]))
  }, [])

  return (
    <div className="bg-sf min-h-screen">
      <header className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-5 py-4 sm:px-8">
        <a href="#top" onClick={() => (window.location.hash = '')} className="flex items-baseline gap-1.5">
          <span className="font-deva text-tx text-[19px] leading-none">यादें</span>
          <span className="text-tx-tertiary text-[13px] font-medium">Yaadein · Family</span>
        </a>
        <div className="flex gap-2">
          <a href="#/try" className="pill pill-ghost !py-2 !text-[13px]">Talk to Yaadein</a>
          <a href="#top" onClick={() => (window.location.hash = '')} className="pill pill-ghost !py-2 !text-[13px]">← Site</a>
        </div>
      </header>

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
          {!people.length && (
            <p className="text-tx-tertiary text-[14px]">No one yet — have a first conversation on the Try page.</p>
          )}
        </div>

        {/* tabs */}
        {pid !== null && (
          <>
            <div className="border-st-secondary mt-7 flex gap-5 border-b">
              {(
                [
                  ['briefing', 'This Sunday'],
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
              {tab === 'briefing' && <BriefingTab pid={pid} />}
              {tab === 'memoir' && <MemoirTab pid={pid} />}
              {tab === 'memories' && <MemoriesTab pid={pid} />}
              {tab === 'photos' && <PhotosTab pid={pid} />}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

/* ── briefing ─────────────────────────────────────────────────── */

function BriefingTab({ pid }: { pid: number }) {
  const [b, setB] = useState<Briefing | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    setB(null)
    setErr(false)
    fetch(`${API}/api/people/${pid}/briefing`)
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

/* ── memoir ───────────────────────────────────────────────────── */

function MemoirTab({ pid }: { pid: number }) {
  const [m, setM] = useState<Memoir | null>(null)
  const [lang, setLang] = useState<'original' | 'en'>('original')
  const [loading, setLoading] = useState(false)
  const [narrating, setNarrating] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const load = useCallback((withEnglish: boolean) => {
    setLoading(true)
    fetch(`${API}/api/people/${pid}/memoir${withEnglish ? '?lang=en-IN' : ''}`)
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
      const r = await fetch(`${API}/api/narrate`, {
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
    fetch(`${API}/api/people/${pid}/memories`)
      .then((r) => r.json())
      .then((j) => {
        setMems(j.memories)
        setLoop(j.open_loop?.topic ?? null)
      })
  }, [pid])
  useEffect(() => { setMems(null); load() }, [pid, load])

  const act = async (url: string, body: object) => {
    await fetch(`${API}${url}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
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
    fetch(`${API}/api/people/${pid}/photos`).then((r) => r.json()).then(setPhotos)
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
      const b64 = btoa(String.fromCharCode(...new Uint8Array(await f.arrayBuffer())))
      const r = await fetch(`${API}/api/people/${pid}/photos`, {
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
