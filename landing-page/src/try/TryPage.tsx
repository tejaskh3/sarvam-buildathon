import { useCallback, useEffect, useRef, useState } from 'react'
import { PipecatClient } from '@pipecat-ai/client-js'
import { SmallWebRTCTransport } from '@pipecat-ai/small-webrtc-transport'
import { Orb, VoiceLabel, type Voice } from '../components/Orb'
import { PhoneGate, clearStoredPhone, getStoredPhone } from '../components/PhoneGate'
import { Logo } from '../components/Logo'

/* ------------------------------------------------------------------
   Try Yaadein — a continuous Pipecat WebRTC voice session.
   The microphone stays live between turns, so speech can naturally
   interrupt the agent and no audio has to be recorded/uploaded first.
   ------------------------------------------------------------------ */

/* ⚠ DO NOT hardcode localhost as the production fallback.
   In production the Node server serves this page AND /api/* on the same
   origin, so API must be '' (relative). localhost is for `vite dev` only —
   an unconditional localhost fallback breaks the deployed site for
   everyone except the machine it was built on. */
const API =
  (import.meta.env.VITE_API_BASE as string | undefined) ??
  (import.meta.env.DEV ? 'http://localhost:3000' : '')

const REALTIME =
  (import.meta.env.VITE_REALTIME_URL as string | undefined) ??
  `${window.location.protocol}//${window.location.hostname}:7860`

export function TryPage() {
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
  const levelRef = useRef(0)
  const sessionRef = useRef<string | null>(null)
  const clientRef = useRef<PipecatClient | null>(null)
  const botAudioRef = useRef<HTMLAudioElement | null>(null)
  const sessionStartRef = useRef<{
    sessionId: string
    text: string
    language: string
  } | null>(null)

  const setState = (v: Voice, b = false) => {
    voiceRef.current = v
    setVoice(v)
    setBusy(b)
  }

  const handleServerMessage = useCallback((payload: unknown) => {
    const wrapped = payload as { data?: unknown }
    const message = (wrapped?.data ?? payload) as {
      type?: string
      transcript?: string
      text?: string
      contract?: Record<string, unknown>
      message?: string
    }
    if (message.type === 'error') {
      setError(message.message || 'The realtime voice service had a problem.')
      return
    }
    if (message.type !== 'turn' || !message.text) return
    const reply = message.text
    if (message.contract) setContract(message.contract)
    setLines((current) => [
      ...current,
      ...(message.transcript ? [{ who: 'you' as const, text: message.transcript }] : []),
      { who: 'agent', text: reply },
    ])
  }, [])

  /* The first tap connects a continuous WebRTC session. Later taps only
     mute/unmute it; speaking naturally while Yaadein talks is barge-in. */
  const toggle = useCallback(async () => {
    if (!phoneRef.current) return void gateRef.current(true) // need the number first
    const connected = clientRef.current
    if (connected?.connected) {
      // Some browsers require one more user gesture before allowing WebRTC
      // audio playback. If that happened, use this tap to unlock the speaker
      // without unexpectedly muting the microphone.
      const botAudio = botAudioRef.current
      if (botAudio?.srcObject && botAudio.paused) {
        try {
          await botAudio.play()
          setError(null)
          return
        } catch {
          setError('Your browser is blocking speaker playback. Allow sound for this site and tap again.')
          return
        }
      }
      const enable = !connected.isMicEnabled
      await connected.enableMic(enable)
      levelRef.current = 0
      setState(enable ? 'listening' : 'idle')
      return
    }
    if (busy) return
    setError(null)
    setState('idle', true)
    let client: PipecatClient | null = null
    try {
      if (!sessionStartRef.current) {
        // the number IS the person — a returning number resumes its thread
        const r = await fetch(`${API}/api/session/start`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ phone: phoneRef.current, realtime: true }),
        })
        if (r.status === 403) {
          clearStoredPhone()
          setPhone(null)
          setState('idle')
          return
        }
        const j = await r.json()
        if (j.error) throw new Error(j.error)
        sessionRef.current = j.sessionId
        sessionStartRef.current = {
          sessionId: j.sessionId,
          text: j.text,
          language: j.language || 'hi-IN',
        }
        if (j.theme) setTheme(j.theme)
        setLines((l) => [...l, { who: 'agent', text: j.text, photo: j.photo ?? undefined }])
      }

      const start = sessionStartRef.current
      if (!start) throw new Error('Could not start the conversation')
      const transport = new SmallWebRTCTransport()
      client = new PipecatClient({
        transport,
        enableMic: true,
        enableCam: false,
        callbacks: {
          onConnected: () => setState('listening'),
          onDisconnected: () => {
            levelRef.current = 0
            clientRef.current = null
            if (botAudioRef.current) botAudioRef.current.srcObject = null
            setState('idle')
          },
          onError: (message) => {
            const detail = (message as { data?: { message?: string } }).data?.message
            setError(detail || 'The realtime voice connection had a problem.')
          },
          onDeviceError: (deviceError) => setError(deviceError.message),
          onLocalAudioLevel: (level) => {
            if (voiceRef.current !== 'speaking') levelRef.current = Math.min(level * 2.5, 1)
          },
          onRemoteAudioLevel: (level) => {
            if (voiceRef.current === 'speaking') levelRef.current = Math.min(level * 2.5, 1)
          },
          onTrackStarted: (track, participant) => {
            // SmallWebRTCTransport exposes the bot track but does not render it.
            // The React Pipecat package normally supplies an audio player; this
            // page uses client-js directly, so attach the remote track here.
            if (track.kind !== 'audio' || participant?.local) return
            const botAudio = botAudioRef.current
            if (!botAudio) return
            botAudio.srcObject = new MediaStream([track])
            botAudio.muted = false
            botAudio.volume = 1
            void botAudio.play().catch(() => {
              setError('Your browser is blocking speaker playback. Allow sound for this site and tap the microphone again.')
            })
          },
          onUserStartedSpeaking: () => setState('listening'),
          onUserStoppedSpeaking: () => setState('idle', true),
          onBotStartedSpeaking: () => setState('speaking'),
          onBotStoppedSpeaking: () => {
            levelRef.current = 0
            setState(client?.isMicEnabled ? 'listening' : 'idle')
          },
          onServerMessage: handleServerMessage,
        },
      })
      clientRef.current = client
      await client.initDevices()
      // Register the custom Yaadein payload with Pipecat Runner first. The
      // returned session ID then drives its session-scoped WebRTC offer route.
      await client.startBotAndConnect({
        endpoint: `${REALTIME}/start`,
        requestData: {
          transport: 'webrtc',
          body: {
            sessionId: start.sessionId,
            opener: start.text,
            language: start.language,
          },
        },
      })
    } catch (e) {
      if (client) await client.disconnect().catch(() => {})
      clientRef.current = null
      setError(e instanceof Error ? e.message : String(e))
      setState('idle')
    }
  }, [busy, handleServerMessage])

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

  useEffect(
    () => () => {
      const client = clientRef.current
      clientRef.current = null
      if (client) void client.disconnect()
      if (botAudioRef.current) botAudioRef.current.srcObject = null
    },
    [],
  )

  const listening = voice === 'listening'

  return (
    <div className="bg-sf flex min-h-screen flex-col">
      <audio ref={botAudioRef} autoPlay playsInline className="hidden" />
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
          disabled={busy && !clientRef.current?.connected}
          aria-pressed={listening}
          aria-label={
            clientRef.current?.connected
              ? clientRef.current.isMicEnabled
                ? 'Mute microphone'
                : 'Unmute microphone'
              : 'Start realtime conversation'
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
              {busy
                ? 'One moment'
                : clientRef.current?.connected
                  ? 'Paused — tap to unmute'
                  : sessionRef.current
                    ? 'Tap to reconnect'
                    : 'Tap once to begin — then just talk'}
            </span>
          ) : (
            <VoiceLabel voice={voice} />
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-[13px] text-red-800">
            {error}{' '}
            {(API.includes('localhost') || REALTIME.includes('localhost')) &&
              '— are both local services running? (npm start and npm run realtime)'}
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
