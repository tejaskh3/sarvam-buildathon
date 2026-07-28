import { useCallback, useEffect, useRef, useState } from 'react'
import { PipecatClient } from '@pipecat-ai/client-js'
import { SmallWebRTCTransport } from '@pipecat-ai/small-webrtc-transport'
import { type Voice } from '../components/Orb'
import { clearStoredPhone, getStoredPhone } from '../components/PhoneGate'
import { API } from '../lib/api'
import { TryShell } from './TryShell'
import { elderError } from './errors'
import type { Line } from './types'

/* ------------------------------------------------------------------
   Try Yaadein — a continuous Pipecat WebRTC voice session.
   The microphone stays live between turns, so speech can naturally
   interrupt the agent and no audio has to be recorded/uploaded first.
   ------------------------------------------------------------------ */

/* No fallback, deliberately. TryPage mounts this component only when
   VITE_REALTIME_URL is set, and the guess this used to make — hostname:7860 —
   is exactly what would break the deployed site, where no such port exists. */
const REALTIME = (import.meta.env.VITE_REALTIME_URL as string).trim()

export function TryPageRealtime() {
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
          onDeviceError: (deviceError) => setError(elderError(deviceError)),
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
      setError(elderError(e))
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
      micDisabled={busy && !clientRef.current?.connected}
      micActive={listening}
      micLabel={
        clientRef.current?.connected
          ? clientRef.current.isMicEnabled
            ? 'Mute microphone'
            : 'Unmute microphone'
          : 'Start realtime conversation'
      }
      idleHint={
        busy
          ? 'One moment'
          : clientRef.current?.connected
            ? 'Paused — tap to unmute'
            : sessionRef.current
              ? 'Tap to reconnect'
              : 'Tap once to begin — then just talk'
      }
      thinking={busy}
      errorHint={
        API.includes('localhost') || REALTIME.includes('localhost')
          ? '— are both local services running? (npm start and npm run realtime)'
          : undefined
      }
    >
      {/* SmallWebRTCTransport exposes the bot track but does not render it, so
          the remote audio needs a real element to attach to. */}
      <audio ref={botAudioRef} autoPlay playsInline className="hidden" />
    </TryShell>
  )
}
