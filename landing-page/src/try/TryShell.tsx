import type { ReactNode, RefObject } from 'react'
import { Orb, VoiceLabel, ThinkingLabel, type Voice } from '../components/Orb'
import { PhoneGate } from '../components/PhoneGate'
import { Logo } from '../components/Logo'
import { API } from '../lib/api'
import type { Line } from './types'

/* ------------------------------------------------------------------
   Everything the elder sees, for either transport.

   The two voice pages differ entirely in HOW they move audio — one records
   and uploads, the other holds a WebRTC session open — and not at all in what
   they draw. They used to carry a byte-identical copy of this markup, some
   170 lines each, which is how a fix to one silently skipped the other.

   So the transports keep their own logic and hand the differences in as
   props: what the microphone button is called right now, whether it is
   disabled, what the idle line reads, and what to append to an error. The
   `children` slot exists for the one element only realtime needs — a hidden
   <audio> for the bot's remote track.
   ------------------------------------------------------------------ */

export type TryShellProps = {
  /* the elder's number, and the gate shown until there is one */
  phone: string | null
  gateOpen: boolean
  onPhone: (phone: string) => void
  onCloseGate: () => void

  /* today's activity, chosen server-side (display only) */
  theme: { title: string } | null

  voice: Voice
  levelRef: RefObject<number>
  lines: Line[]
  error: string | null
  contract: Record<string, unknown> | null

  /* the one control on the page */
  onMic: () => void
  micDisabled: boolean
  micActive: boolean
  micLabel: string
  /** what the line under the orb says while nothing is happening */
  idleHint: string
  /** a turn is in flight — the hint gets a wave, so the wait reads as work */
  thinking?: boolean
  /** appended to an error when it is worth naming what is not running */
  errorHint?: string

  children?: ReactNode
}

export function TryShell({
  phone, gateOpen, onPhone, onCloseGate,
  theme, voice, levelRef, lines, error, contract,
  onMic, micDisabled, micActive, micLabel, idleHint, thinking, errorHint,
  children,
}: TryShellProps) {
  const lastAgent = [...lines].reverse().find((l) => l.who === 'agent')

  return (
    <div className="bg-sf flex min-h-screen flex-col">
      {!phone && gateOpen && (
        <PhoneGate api={API} onDone={onPhone} onClose={onCloseGate} forElder />
      )}
      {children}
      <header className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-5 py-4 sm:px-8">
        <a
          href="#top"
          onClick={() => (window.location.hash = '')}
          className="flex items-center gap-2.5"
        >
          <Logo size={34} />
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
          onClick={onMic}
          disabled={micDisabled}
          aria-pressed={micActive}
          aria-label={micLabel}
          className={`-mt-6 flex h-[68px] w-[68px] items-center justify-center rounded-full border transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
            micActive
              ? 'border-sr-purple-600 bg-sr-purple-600 scale-105 text-white shadow-[0_0_0_10px_rgba(109,92,240,0.14)]'
              : 'border-st-secondary text-tx hover:border-tx bg-white'
          }`}
        >
          <MicIcon />
        </button>

        <div className="mt-5 flex h-5 items-center">
          {voice !== 'idle' ? (
            <VoiceLabel voice={voice} />
          ) : thinking ? (
            /* idleHint is already "One moment" in both transports while busy;
               the wave is the part that says it is still working. */
            <ThinkingLabel label={idleHint} />
          ) : (
            <span className="text-tx-tertiary font-mono text-[11px] tracking-[0.16em] uppercase">
              {idleHint}
            </span>
          )}
        </div>

        {/* Sized for the person reading it. This was 13px red text — the same
            treatment a developer console gets — on the one screen built for
            someone whose eyesight and patience we should assume nothing about.
            role="alert" so a screen reader announces it without being asked. */}
        {error && (
          <p
            role="alert"
            className="border-sr-rose-100 mt-5 max-w-[460px] rounded-2xl border bg-white px-5 py-4 text-[15px] leading-relaxed text-pretty text-red-900"
          >
            {error}
            {errorHint && (
              <span className="text-tx-tertiary mt-1.5 block text-[12.5px]">{errorHint}</span>
            )}
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
        {lastAgent && (
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
        )}
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
