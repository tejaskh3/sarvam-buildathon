import { useState, useEffect, useRef, useCallback } from 'react'
import { authFetch } from '../../lib/auth'
import { API } from '../../lib/api'
import type { ScribeRow } from '../types'
import { Loading } from '../ui'
import { encodeWavPcm } from '../lib/wav'

/* Session notes — Scribe records a human-run session and writes it up. */

export function ScribeTab({ pid, phone }: { pid: number; phone: string | null }) {
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
