import { useCallback, useEffect, useRef, useState } from 'react'
import { Orb, VoiceLabel, type Voice } from '../components/Orb'
import { PhoneGate, clearStoredPhone, getStoredPhone } from '../components/PhoneGate'
import { Logo } from '../components/Logo'

/* ------------------------------------------------------------------
   Try Yaadein — a live voice session.
   One microphone button. Tap it (or press space) and talk: the orb
   turns purple and says Listening. When Yaadein replies it turns pink
   and says Speaking. Nothing else on screen.
   API base comes from VITE_API_BASE so the deployed static site can
   point at a hosted agent server; defaults to localhost for dev.
   ------------------------------------------------------------------ */

/* ⚠ DO NOT hardcode localhost as the production fallback.
   In production the Node server serves this page AND /api/* on the same
   origin, so API must be '' (relative). localhost is for `vite dev` only —
   an unconditional localhost fallback breaks the deployed site for
   everyone except the machine it was built on. */
const API =
  (import.meta.env.VITE_API_BASE as string | undefined) ??
  (import.meta.env.DEV ? 'http://localhost:3000' : '')

const SILENCE_MS = 1400 // auto-send after this much quiet
const SILENCE_RMS = 0.012
const MAX_REC_MS = 25000 // Saaras REST caps at 30s — send before we hit it

export function TryPageRest() {
  const [voice, setVoice] = useState<Voice>('idle')
  const [busy, setBusy] = useState(false)
  type PhotoCard = { url: string; event: string; place: string; year: string; people: string[] }
  const [lines, setLines] = useState<{ who: 'agent' | 'you'; text: string; photo?: PhotoCard }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [contract, setContract] = useState<Record<string, unknown> | null>(null)
  /* today's CST activity, chosen server-side (display only) */
  const [theme, setTheme] = useState<{ key: string; title: string; title_en: string } | null>(null)
  /* access = an allowlisted 10-digit number; remembered on this device */
  /* A setup link (#/try?n=9876543210) is how a family hands this device to the
     elder: they send it on WhatsApp, the elder taps once, and this screen never
     asks for anything again. Typing a 10-digit number is precisely what the
     person this is built for cannot do. */
  const [phone, setPhone] = useState<string | null>(() => {
    const linked = new URLSearchParams(window.location.hash.split('?')[1] || '').get('n')
    if (linked && /^\d{10}$/.test(linked)) {
      localStorage.setItem('yaadein-phone', linked)
      // drop the number from the address bar so it isn't re-shared by accident
      history.replaceState(null, '', window.location.pathname + '#/try')
      return linked
    }
    return getStoredPhone()
  })
  const [gateOpen, setGateOpen] = useState(true) // closable; mic tap reopens
  const phoneRef = useRef(phone)
  phoneRef.current = phone
  const gateRef = useRef<typeof setGateOpen>(setGateOpen)
  gateRef.current = setGateOpen
  const voiceRef = useRef<Voice>('idle')
  const busyRef = useRef(false)
  const levelRef = useRef(0)
  const sessionRef = useRef<string | null>(null)
  const recRef = useRef<{ chunks: Float32Array[]; lastVoice: number; startedAt: number; hasVoice?: boolean; delayMs?: number } | null>(null)
  /* recall-difficulty signal: when Yaadein's question finished playing —
     the gap until their first word is how hard the question was */
  const agentDoneAtRef = useRef<number | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  /* dead-air kill: preloaded "achha…" clips, played the moment a turn is sent */
  const acksRef = useRef<AudioBuffer[]>([])
  /* barge-in: the currently playing reply, stoppable mid-word */
  const playingRef = useRef<{ src: AudioBufferSourceNode; interrupted: boolean } | null>(null)

  const setState = (v: Voice, b = false) => {
    voiceRef.current = v
    busyRef.current = b
    setVoice(v)
    setBusy(b)
  }

  const decode = useCallback(async (b64: string) => {
    const ctx = audioCtxRef.current!
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    return ctx.decodeAudioData(bytes.buffer.slice(0))
  }, [])

  /* a short acknowledgment, no state change — covers the thinking gap */
  const playAck = useCallback(() => {
    const ctx = audioCtxRef.current
    const acks = acksRef.current
    if (!ctx || !acks.length) return
    const src = ctx.createBufferSource()
    src.buffer = acks[Math.floor(Math.random() * acks.length)]
    src.connect(ctx.destination)
    src.start()
  }, [])

  const play = useCallback(async (b64: string) => {
    const ctx = audioCtxRef.current!
    const buf = await decode(b64)
    const src = ctx.createBufferSource()
    src.buffer = buf
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    src.connect(analyser)
    analyser.connect(ctx.destination)
    const data = new Uint8Array(analyser.frequencyBinCount)
    const handle = { src, interrupted: false }
    playingRef.current = handle
    setState('speaking')
    const meter = setInterval(() => {
      analyser.getByteTimeDomainData(data)
      let sum = 0
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128
        sum += v * v
      }
      levelRef.current = Math.min(Math.sqrt(sum / data.length) * 4, 1)
    }, 50)
    await new Promise<void>((resolve) => {
      src.onended = () => resolve()
      src.start()
    })
    clearInterval(meter)
    levelRef.current = 0
    playingRef.current = null
    agentDoneAtRef.current = Date.now()
    /* barge-in: if she interrupted, the caller already owns the state */
    if (!handle.interrupted) setState('idle')
  }, [decode])

  const finishRecording = useCallback(async () => {
    const rec = recRef.current
    if (!rec) return
    recRef.current = null
    levelRef.current = 0
    const wav = encodeWav(rec.chunks, 16000)
    if (!rec.hasVoice || wav.size < 8000) {
      setState('idle') // nothing was said — no ack, no STT call
      return
    }
    setState('idle', true)
    playAck() // she hears "achha…" instantly — never dead air while we think
    try {
      const r = await fetch(`${API}/api/turn`, {
        method: 'POST',
        headers: {
          'x-session-id': sessionRef.current!,
          ...(rec.delayMs != null ? { 'x-delay-ms': String(rec.delayMs) } : {}),
        },
        body: wav,
      })
      const j = await r.json()
      if (j.error) throw new Error(j.error)
      if (!j.transcript) {
        setState('idle')
        return
      }
      if (j.contract) setContract(j.contract)
      setLines((l) => [
        ...l,
        { who: 'you', text: j.transcript },
        { who: 'agent', text: j.text },
      ])
      await play(j.audio)
      /* hands-free: when Yaadein finishes, the floor returns to them
         automatically — no button between turns. Staying quiet ends the
         loop gracefully (short/empty audio → idle). */
      if (voiceRef.current === 'idle' && !busyRef.current) {
        recRef.current = { chunks: [], lastVoice: Date.now(), startedAt: Date.now() }
        setState('listening')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setState('idle')
    }
  }, [play, playAck])

  const ensureMic = useCallback(async () => {
    if (audioCtxRef.current) return
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    })
    const ctx = new AudioContext({ sampleRate: 16000 })
    const src = ctx.createMediaStreamSource(stream)
    const proc = ctx.createScriptProcessor(4096, 1, 1)
    proc.onaudioprocess = (e) => {
      const rec = recRef.current
      if (!rec) return
      const data = new Float32Array(e.inputBuffer.getChannelData(0))
      rec.chunks.push(data)
      let sum = 0
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
      const rms = Math.sqrt(sum / data.length)
      levelRef.current = Math.min(rms * 12, 1)
      if (rms > SILENCE_RMS) {
        if (!rec.hasVoice && agentDoneAtRef.current)
          rec.delayMs = Math.max(0, Date.now() - agentDoneAtRef.current)
        rec.lastVoice = Date.now()
        rec.hasVoice = true
      } else if (rec.hasVoice && Date.now() - rec.lastVoice > SILENCE_MS) {
        void finishRecording() // they spoke, then went quiet → send
      } else if (!rec.hasVoice && Date.now() - rec.startedAt > 6000) {
        void finishRecording() // never spoke → give the floor back quietly
      }
      // STT rejects >30s — flush before the limit, mid-story if needed
      if (Date.now() - rec.startedAt > MAX_REC_MS) void finishRecording()
    }
    src.connect(proc)
    proc.connect(ctx.destination)
    audioCtxRef.current = ctx
    /* preload ack clips once the AudioContext exists */
    fetch(`${API}/api/acks`)
      .then((r) => r.json())
      .then(async (j) => {
        const bufs: AudioBuffer[] = []
        for (const b64 of j.acks || []) {
          const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
          bufs.push(await ctx.decodeAudioData(bytes.buffer.slice(0)))
        }
        acksRef.current = bufs
      })
      .catch(() => { /* acks are progressive enhancement */ })
  }, [finishRecording])

  /* the one control: start talking, or stop and send.
     Tapping while Yaadein speaks = barge-in: she stops mid-word,
     the floor is yours, context is kept (A6). */
  const toggle = useCallback(async () => {
    if (busyRef.current) return
    if (!phoneRef.current) return void gateRef.current(true) // need the number first
    if (voiceRef.current === 'speaking') {
      const p = playingRef.current
      if (p) {
        p.interrupted = true
        try { p.src.stop() } catch { /* already ended */ }
      }
      agentDoneAtRef.current = Date.now() // barge-in = they answered instantly
      recRef.current = { chunks: [], lastVoice: Date.now(), startedAt: Date.now() }
      setState('listening')
      return
    }
    if (voiceRef.current === 'listening') return void finishRecording()
    setError(null)
    try {
      await ensureMic()
      if (!sessionRef.current) {
        setState('idle', true)
        // the number IS the person — a returning number resumes its thread
        const r = await fetch(`${API}/api/session/start`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ phone: phoneRef.current }),
        })
        if (r.status === 403) {
          // number fell off the allowlist — ask again
          clearStoredPhone()
          setPhone(null)
          setState('idle')
          return
        }
        const j = await r.json()
        if (j.error) throw new Error(j.error)
        sessionRef.current = j.sessionId
        if (j.theme) setTheme(j.theme)
        setLines((l) => [...l, { who: 'agent', text: j.text, photo: j.photo ?? undefined }])
        await play(j.audio)
      }
      recRef.current = { chunks: [], lastVoice: Date.now(), startedAt: Date.now() }
      setState('listening')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setState('idle')
    }
  }, [ensureMic, finishRecording, play])

  /* space bar does exactly what the microphone does */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return
      e.preventDefault() // never scroll the page
      if (e.repeat) return
      void toggle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])

  const listening = voice === 'listening'

  return (
    <div className="bg-sf flex min-h-screen flex-col">
      {!phone && gateOpen && (
        <PhoneGate api={API} onDone={setPhone} onClose={() => setGateOpen(false)} forElder />
      )}
      <header className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-5 py-4 sm:px-8">
        <a
          href="#top"
          onClick={() => (window.location.hash = '')}
          className="flex items-center gap-2.5"
        >
          <Mark />
          <span className="font-season text-tx text-[20px] leading-none">
            Yaadein
          </span>
        </a>
        <a
          href="#top"
          onClick={() => (window.location.hash = '')}
          className="pill pill-ghost !py-2 !text-[13px]"
        >
          ← Back to site
        </a>
      </header>

      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col items-center px-5 pt-6 pb-12">
        {theme ? (
          <div
            className="border-sr-indigo-700/20 bg-sr-indigo-700/5 flex items-center gap-2 rounded-full border px-4 py-1.5"
            title="Today's activity, from the clinically validated cognitive stimulation protocol"
          >
            <span className="text-sr-indigo-700 font-mono text-[9px] tracking-[0.16em] uppercase">
              Aaj ki baithak
            </span>
            <span className="text-tx text-[13px] font-medium">{theme.title}</span>
          </div>
        ) : (
          <p className="text-tx-tertiary font-mono text-[10px] tracking-[0.2em] uppercase">
            Live demo · speaks every Indian language
          </p>
        )}

        <Orb voice={voice} levelRef={levelRef} className="mt-2 w-full max-w-[420px]" />

        {/* the only control on the page */}
        <button
          onClick={() => void toggle()}
          disabled={busy}
          aria-pressed={listening}
          aria-label={
            voice === 'speaking' ? 'Interrupt and talk' : listening ? 'Stop and send' : 'Start talking'
          }
          className={`-mt-6 flex h-[68px] w-[68px] items-center justify-center rounded-full border transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
            listening
              ? 'border-sr-purple-600 bg-sr-purple-600 scale-105 text-white shadow-[0_0_0_10px_rgba(109,92,240,0.14)]'
              : 'border-st-secondary text-tx hover:border-tx bg-white'
          }`}
        >
          <MicIcon />
        </button>

        <div className="mt-5 flex h-5 items-center">
          {voice === 'idle' ? (
            <span className="text-tx-tertiary font-mono text-[11px] tracking-[0.16em] uppercase">
              {busy ? 'One moment' : sessionRef.current ? 'Paused — tap to continue talking' : 'Tap once to begin — then just talk'}
            </span>
          ) : (
            <VoiceLabel voice={voice} />
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-[13px] text-red-800">
            {error}{' '}
            {API.includes('localhost') &&
              '— is the agent server running? (node app/server.js)'}
          </p>
        )}

        {contract && (
          <div className="mt-6 flex w-full flex-wrap items-center justify-center gap-1.5">
            {(['RESUMED', 'CAPTURED', 'CLOSED', 'WRITTEN', 'SAFE'] as const).map((k) => {
              const v = contract[k]
              const on = typeof v === 'number' ? v > 0 : !!v
              return (
                <span
                  key={k}
                  className={`rounded-full px-2.5 py-1 font-mono text-[9px] tracking-[0.12em] ${
                    on ? 'bg-sr-green-600/10 text-sr-green-600' : 'bg-sf-secondary text-tx-tertiary'
                  }`}
                  title="Session Contract — every session passes or fails, live"
                >
                  {on ? '✓' : '·'} {k}
                  {typeof v === 'number' && v > 0 ? ` ${v}` : ''}
                </span>
              )
            })}
          </div>
        )}

        {/* voice-first: no chat history — only Yaadein's latest words,
            centered like a caption under the orb */}
        {(() => {
          const lastAgent = [...lines].reverse().find((l) => l.who === 'agent')
          if (!lastAgent) return null
          return (
            <div key={lines.length} className="caption-fade mt-8 flex w-full flex-col items-center text-center">
              {lastAgent.photo && (
                <figure className="photo-pop mb-5 w-full max-w-[360px] rotate-[-1deg] rounded-2xl bg-white p-3 pb-4 shadow-[0_10px_36px_rgba(30,32,51,0.16)]">
                  <img
                    src={`${API}${lastAgent.photo.url}`}
                    alt={lastAgent.photo.event || 'A family memory'}
                    className="aspect-[4/3] w-full rounded-xl object-cover"
                  />
                  <figcaption className="mt-3 text-center">
                    {(lastAgent.photo.event || lastAgent.photo.place || lastAgent.photo.year) && (
                      <p className="font-season text-tx text-[16px] leading-snug">
                        {lastAgent.photo.event || 'A family moment'}
                        {(lastAgent.photo.place || lastAgent.photo.year) && (
                          <span className="text-tx-tertiary">
                            {' '}· {[lastAgent.photo.place, lastAgent.photo.year].filter(Boolean).join(', ')}
                          </span>
                        )}
                      </p>
                    )}
                    {lastAgent.photo.people.length > 0 && (
                      <p className="text-tx-secondary mt-1 text-[12.5px]">
                        In this photo: {lastAgent.photo.people.join(' · ')}
                      </p>
                    )}
                    <p className="text-tx-tertiary mt-1 font-mono text-[9px] tracking-[0.14em] uppercase">
                      Shared by your family
                    </p>
                  </figcaption>
                </figure>
              )}
              <p className="text-tx max-w-[540px] text-[17px] leading-relaxed text-balance">
                {lastAgent.text}
              </p>
            </div>
          )
        })()}
      </main>
    </div>
  )
}

function MicIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="9"
        y="3"
        width="6"
        height="11"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function Mark() {
  return <Logo size={34} />
}

/* ── wav encoding ── */

function encodeWav(chunks: Float32Array[], rate: number) {
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
  W(0, 'RIFF')
  dv.setUint32(4, 36 + pcm.length * 2, true)
  W(8, 'WAVE')
  W(12, 'fmt ')
  dv.setUint32(16, 16, true)
  dv.setUint16(20, 1, true)
  dv.setUint16(22, 1, true)
  dv.setUint32(24, rate, true)
  dv.setUint32(28, rate * 2, true)
  dv.setUint16(32, 2, true)
  dv.setUint16(34, 16, true)
  W(36, 'data')
  dv.setUint32(40, pcm.length * 2, true)
  new Int16Array(buf, 44).set(pcm)
  return new Blob([buf], { type: 'audio/wav' })
}
