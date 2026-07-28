import { useCallback, useEffect, useRef, useState } from 'react'
import { type Voice } from '../components/Orb'
import { clearStoredPhone, getStoredPhone } from '../components/PhoneGate'
import { API } from '../lib/api'
import { encodeWavPcm } from '../lib/wav'
import { TryShell } from './TryShell'
import { elderError } from './errors'
import type { Line } from './types'

/* ------------------------------------------------------------------
   Try Yaadein — a live voice session.
   One microphone button. Tap it (or press space) and talk: the orb
   turns purple and says Listening. When Yaadein replies it turns pink
   and says Speaking. Nothing else on screen.
   API base comes from VITE_API_BASE so the deployed static site can
   point at a hosted agent server; defaults to localhost for dev.
   ------------------------------------------------------------------ */

const SILENCE_MS = 1400 // auto-send after this much quiet
const SILENCE_RMS = 0.012
const MAX_REC_MS = 25000 // Saaras REST caps at 30s — send before we hit it

export function TryPageRest() {
  const [voice, setVoice] = useState<Voice>('idle')
  const [busy, setBusy] = useState(false)
  const [lines, setLines] = useState<Line[]>([])
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
    const wav = encodeWavPcm(rec.chunks, 16000)
    if (!rec.hasVoice || wav.size < 8000) {
      setState('idle') // nothing was said — no STT call
      return
    }
    /* The pause here is silent on purpose.
       There used to be a bank of pre-rendered clips — "achha…", "haan haan…",
       "theek hai" — fired the instant she stopped speaking, to cover the
       second or two of thinking. It solved dead air and bought a verbal tic:
       the same five sounds answering literally every turn, before Yaadein had
       heard a word of what was said. An acknowledgement that cannot have been
       earned stops reading as listening and starts reading as a machine
       beeping back. The wait is now carried by "One moment" under the orb,
       which says the same thing without pretending to have understood. */
    setState('idle', true)
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
      /* A restart or a deploy wipes the in-memory session map, so the server
         answers `unknown_session`. This used to leave sessionRef set, which
         made every further tap re-send to the same dead session and get the
         same error for ever — the elder's only way out was reloading the page,
         which is exactly what this person cannot be asked to do. Clearing it
         means the next tap opens a fresh conversation.

         j.message, not j.error: the server writes real sentences for the
         failures it knows about ("we're topping up our voice service"), and
         throwing the CODE discarded all of them and fell through to the
         generic fallback. */
      if (j.error === 'unknown_session') sessionRef.current = null
      if (j.error) throw new Error(j.message || j.error)
      if (!j.transcript) {
        setState('idle')
        return
      }
      if (j.contract) setContract(j.contract)
      setLines((l) => [
        ...l,
        { who: 'you', text: j.transcript },
        /* A photo can now arrive on any turn, not only the opener — the
           server picks the moment. Attaching it here is what makes it appear
           on screen while Yaadein describes it aloud. */
        { who: 'agent', text: j.text, photo: j.photo ?? undefined },
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
      setError(elderError(e))
      setState('idle')
    }
  }, [play])

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
      setError(elderError(e))
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
    <TryShell
      phone={phone}
      gateOpen={gateOpen}
      onPhone={setPhone}
      onCloseGate={() => setGateOpen(false)}
      theme={theme}
      voice={voice}
      levelRef={levelRef}
      lines={lines}
      error={error}
      contract={contract}
      onMic={() => void toggle()}
      micDisabled={busy}
      micActive={listening}
      micLabel={
        voice === 'speaking' ? 'Interrupt and talk' : listening ? 'Stop and send' : 'Start talking'
      }
      idleHint={
        busy
          ? 'One moment'
          : sessionRef.current
            ? 'Paused — tap to continue talking'
            : 'Tap once to begin — then just talk'
      }
      thinking={busy}
      errorHint={
        API.includes('localhost') ? '— is the agent server running? (node app/server.js)' : undefined
      }
    />
  )
}
