import { useEffect, useRef, useState } from 'react'

/* ------------------------------------------------------------------
   Try Yaadein — live voice session with a particle voice-orb.
   States: idle · listening · thinking · speaking (voice-orb.netlify.app
   particle style, in our indigo).
   API base comes from VITE_API_BASE so the deployed static site can
   point at a hosted agent server; defaults to localhost for dev.
   ------------------------------------------------------------------ */

// Same-origin by default: the Node server serves both this page and /api/*.
// '' → relative URLs. localhost:3000 only during `vite dev` (separate ports).
// VITE_API_BASE overrides both if the API is ever hosted elsewhere.
const API =
  (import.meta.env.VITE_API_BASE as string | undefined) ??
  (import.meta.env.DEV ? 'http://localhost:3000' : '')

type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking'

const STATE_LABEL: Record<OrbState, string> = {
  idle: 'Tap the orb to talk',
  listening: 'Listening… pause, and I’ll reply',
  thinking: 'Thinking…',
  speaking: 'Speaking',
}

/* ── particle orb ─────────────────────────────────────────────── */

const N = 3200
const SILENCE_MS = 1400 // auto-send after this much quiet
const SILENCE_RMS = 0.012

function makeParticles() {
  // fibonacci sphere + fuzzy radial outliers (the "dust" look)
  const pts: { x: number; y: number; z: number; fuzz: number; phase: number }[] = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    const th = golden * i
    const fuzz = 1 + Math.pow(Math.random(), 6) * 0.9 + (Math.random() - 0.5) * 0.12
    pts.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r, fuzz, phase: Math.random() * Math.PI * 2 })
  }
  return pts
}

export function TryPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [state, setState] = useState<OrbState>('idle')
  const [lines, setLines] = useState<{ who: 'agent' | 'you'; text: string }[]>([])
  const [error, setError] = useState<string | null>(null)

  // refs shared with the render/audio loops
  const stateRef = useRef<OrbState>('idle')
  const levelRef = useRef(0) // 0..1 live audio energy (mic or TTS)
  const sessionRef = useRef<string | null>(null)
  const recRef = useRef<{ chunks: Float32Array[]; lastVoice: number } | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const micNodeRef = useRef<ScriptProcessorNode | null>(null)

  const setOrb = (s: OrbState) => {
    stateRef.current = s
    setState(s)
  }

  /* ── canvas render loop ── */
  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const pts = makeParticles()
    let raf = 0
    let rot = 0
    let energy = 0

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const size = () => {
      const s = Math.min(canvas.clientWidth, 520)
      canvas.width = s * dpr
      canvas.height = s * dpr
    }
    size()
    window.addEventListener('resize', size)

    const tick = (t: number) => {
      const s = stateRef.current
      // target energy per state; live level rides on top
      const target =
        s === 'listening' ? 0.25 + levelRef.current * 1.4
        : s === 'speaking' ? 0.2 + levelRef.current * 1.2
        : s === 'thinking' ? 0.35 + 0.15 * Math.sin(t / 180)
        : 0.08 + 0.04 * Math.sin(t / 900)
      energy += (Math.min(target, 1.1) - energy) * 0.08
      rot += s === 'thinking' ? 0.004 : 0.0012

      const w = canvas.width
      ctx.clearRect(0, 0, w, w)
      const cx = w / 2
      const R = w * 0.27 * (1 + energy * 0.22)
      const cos = Math.cos(rot)
      const sin = Math.sin(rot)

      for (const p of pts) {
        const x = p.x * cos - p.z * sin
        const z = p.x * sin + p.z * cos
        const jitter = 1 + Math.sin(t / 300 + p.phase) * 0.015 * (1 + energy * 3)
        const r = R * p.fuzz * jitter
        const px = cx + x * r
        const py = cx + p.y * r * 0.96
        const depth = (z + 1) / 2
        ctx.globalAlpha = 0.12 + depth * 0.55
        ctx.fillStyle = depth > 0.5 ? '#4f46e5' : '#818cf8'
        const dot = (0.6 + depth * 0.9) * dpr
        ctx.fillRect(px, py, dot, dot)
      }
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', size)
    }
  }, [])

  /* ── audio helpers ── */

  async function ensureMic() {
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
      if (rms > SILENCE_RMS) rec.lastVoice = Date.now()
      else if (Date.now() - rec.lastVoice > SILENCE_MS) void finishRecording()
    }
    src.connect(proc)
    proc.connect(ctx.destination)
    audioCtxRef.current = ctx
    micNodeRef.current = proc
  }

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
    W(0, 'RIFF'); dv.setUint32(4, 36 + pcm.length * 2, true); W(8, 'WAVE'); W(12, 'fmt ')
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true)
    dv.setUint32(24, rate, true); dv.setUint32(28, rate * 2, true)
    dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); W(36, 'data')
    dv.setUint32(40, pcm.length * 2, true)
    new Int16Array(buf, 44).set(pcm)
    return new Blob([buf], { type: 'audio/wav' })
  }

  async function playB64(b64: string) {
    const ctx = audioCtxRef.current!
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const buf = await ctx.decodeAudioData(bytes.buffer.slice(0))
    const src = ctx.createBufferSource()
    src.buffer = buf
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    src.connect(analyser)
    analyser.connect(ctx.destination)
    const data = new Uint8Array(analyser.frequencyBinCount)
    setOrb('speaking')
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
    setOrb('idle')
  }

  /* ── conversation flow ── */

  async function startSession() {
    setOrb('thinking')
    setError(null)
    try {
      await ensureMic()
      const r = await fetch(`${API}/api/session/start`, { method: 'POST' })
      const j = await r.json()
      if (j.error) throw new Error(j.error)
      sessionRef.current = j.sessionId
      setLines((l) => [...l, { who: 'agent', text: j.text }])
      await playB64(j.audio)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setOrb('idle')
    }
  }

  async function finishRecording() {
    const rec = recRef.current
    if (!rec) return
    recRef.current = null
    levelRef.current = 0
    const wav = encodeWav(rec.chunks, 16000)
    if (wav.size < 8000) {
      setOrb('idle')
      return
    }
    setOrb('thinking')
    try {
      const r = await fetch(`${API}/api/turn`, {
        method: 'POST',
        headers: { 'x-session-id': sessionRef.current! },
        body: wav,
      })
      const j = await r.json()
      if (j.error) throw new Error(j.error)
      if (!j.transcript) {
        setOrb('idle')
        return
      }
      setLines((l) => [...l, { who: 'you', text: j.transcript }, { who: 'agent', text: j.text }])
      await playB64(j.audio)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setOrb('idle')
    }
  }

  async function onOrbClick() {
    const s = stateRef.current
    if (s === 'thinking' || s === 'speaking') return
    if (!sessionRef.current) return void startSession()
    if (s === 'listening') return void finishRecording()
    await ensureMic()
    recRef.current = { chunks: [], lastVoice: Date.now() }
    setOrb('listening')
  }

  const last = lines.slice(-4)

  return (
    <div className="bg-sf flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-5 py-4 sm:px-8">
        <a href="#top" onClick={() => (window.location.hash = '')} className="flex items-baseline gap-1.5">
          <span className="font-deva text-tx text-[19px] leading-none">यादें</span>
          <span className="text-tx-tertiary text-[13px] font-medium">Yaadein</span>
        </a>
        <a href="#top" onClick={() => (window.location.hash = '')} className="pill pill-ghost !py-2 !text-[13px]">
          ← Back to site
        </a>
      </header>

      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col items-center px-5 pt-4 pb-12">
        <p className="text-tx-tertiary font-mono text-[10px] tracking-[0.2em] uppercase">
          Live demo · speaks Hindi, English & mixed
        </p>

        <button
          onClick={onOrbClick}
          aria-label={STATE_LABEL[state]}
          className="mt-2 block w-full max-w-[520px] cursor-pointer border-none bg-transparent p-0 outline-none"
        >
          <canvas ref={canvasRef} className="aspect-square w-full" />
        </button>

        {/* state chips, as in the reference */}
        <div className="-mt-4 flex items-center gap-2">
          {(['idle', 'listening', 'speaking', 'thinking'] as OrbState[]).map((s) => (
            <span
              key={s}
              className={`rounded-full px-4 py-1.5 text-[13px] font-medium capitalize transition-colors ${
                state === s ? 'bg-tx text-white' : 'bg-sf-secondary text-tx-tertiary'
              }`}
            >
              {s}
            </span>
          ))}
        </div>

        <p className="text-tx-secondary mt-4 text-[15px]">{STATE_LABEL[state]}</p>
        {error && (
          <p className="mt-2 rounded-lg bg-red-50 px-4 py-2 text-[13px] text-red-800">
            {error} {API.includes('localhost') && '— is the agent server running? (node app/server.js)'}
          </p>
        )}

        <div className="mt-8 w-full space-y-2">
          {last.map((l, i) => (
            <div
              key={lines.length - last.length + i}
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
                l.who === 'agent'
                  ? 'border-st-secondary text-tx border bg-white'
                  : 'bg-sr-indigo-700 ml-auto text-white'
              }`}
            >
              {l.text}
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
