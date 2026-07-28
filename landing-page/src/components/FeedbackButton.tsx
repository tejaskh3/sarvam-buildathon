import { useEffect, useRef, useState } from 'react'
import { API } from '../lib/api'
import { authFetch } from '../lib/auth'

/* ------------------------------------------------------------------
   The floating "tell us" button.

   Deliberately NOT rendered on the elder's screen (#/try) — see App.tsx.
   Their page has exactly one control, and a second floating thing labelled
   "Feedback" would be one more object for someone with memory loss to worry
   about, in English, about software. Everyone else — families, care-centre
   staff, judges — gets it.

   Four moods, then one box. The moods exist because "this is broken" and "I
   have an idea" want different reactions from us, and picking one is cheaper
   than writing a sentence explaining which it is. Nothing is required except
   the words: no name, no account, no email. Asking a stranger to identify
   themselves before they can report a bug is how you stop hearing about bugs.
   ------------------------------------------------------------------ */

type Mood = 'love' | 'idea' | 'confused' | 'broken'

const MOODS: { key: Mood; icon: string; label: string }[] = [
  { key: 'love', icon: '♥', label: 'I like it' },
  { key: 'idea', icon: '✦', label: 'An idea' },
  { key: 'confused', icon: '?', label: 'Confusing' },
  { key: 'broken', icon: '!', label: 'Broken' },
]

export function FeedbackButton() {
  const [open, setOpen] = useState(false)
  const [mood, setMood] = useState<Mood | null>(null)
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const panelRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLTextAreaElement>(null)

  /* Escape closes, and a click outside closes. Both because this thing floats
     over someone else's reading — it must never feel like a trap. */
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    /* mousedown, not click: a click listener fires on the same event that
       opened the panel and closes it again immediately */
    window.addEventListener('mousedown', onDown)
    boxRef.current?.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [open])

  /* Reopening after a send should be a fresh note, not the thank-you again. */
  const toggle = () => {
    if (!open && sent) {
      setSent(false)
      setMessage('')
      setMood(null)
      setErr(null)
    }
    setOpen((v) => !v)
  }

  const submit = async () => {
    if (message.trim().length < 3) {
      setErr('A few more words and we’ll read it.')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      /* authFetch, not fetch: signed in, the note gets tied to the account, so
         a family we already know doesn't have to introduce themselves. */
      const r = await authFetch(`${API}/api/feedback`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          sentiment: mood,
          email: email.trim(),
          /* where they were standing — the hash is the route, and it is most of
             the context we'd otherwise have to ask for */
          page: window.location.hash || '#/',
        }),
      })
      const j = await r.json()
      if (!r.ok || !j.ok) throw new Error(j.message || 'Could not send that.')
      setSent(true)
      setEmail('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed right-4 bottom-4 z-[90] flex flex-col items-end gap-2.5 sm:right-6 sm:bottom-6">
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Send feedback"
          className="border-st-secondary w-[min(92vw,344px)] rounded-2xl border bg-white p-4 shadow-[0_18px_50px_-12px_rgba(30,32,51,0.32)]"
        >
          {sent ? (
            <div className="py-2 text-center">
              <p className="font-season text-tx text-[21px] leading-tight">Thank you — got it.</p>
              <p className="text-tx-secondary mt-2 text-[13.5px] leading-relaxed text-pretty">
                A person reads every one of these. If you left an address and it
                needs an answer, you&apos;ll get one.
              </p>
              <button
                onClick={() => setOpen(false)}
                className="pill pill-ghost mt-4 !py-2 !text-[13px]"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-season text-tx text-[19px] leading-tight">
                    Tell us anything
                  </p>
                  <p className="text-tx-tertiary mt-0.5 text-[12.5px] leading-snug">
                    We&apos;re building this in the open. Blunt is useful.
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="text-tx-tertiary hover:text-tx -mt-1 shrink-0 text-[19px] leading-none transition-colors"
                >
                  ×
                </button>
              </div>

              {/* optional, and it says so by never blocking the send */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {MOODS.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setMood(mood === m.key ? null : m.key)}
                    aria-pressed={mood === m.key}
                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] transition-colors ${
                      mood === m.key
                        ? 'border-tx bg-tx text-white'
                        : 'border-st-secondary text-tx-secondary hover:border-tx bg-white'
                    }`}
                  >
                    <span aria-hidden className="text-[11px] opacity-70">
                      {m.icon}
                    </span>
                    {m.label}
                  </button>
                ))}
              </div>

              <textarea
                ref={boxRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                /* Cmd/Ctrl+Enter sends. Plain Enter must stay a newline — people
                   write more than one sentence, and losing a half-typed note to
                   a stray Return is unforgivable in a feedback box. */
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit()
                }}
                rows={3}
                maxLength={2000}
                placeholder="What worked, what didn't, what you wish it did…"
                className="border-st-secondary text-tx focus:border-tx mt-2.5 w-full resize-none rounded-xl border bg-white px-3 py-2.5 text-[14px] leading-relaxed outline-none transition-colors"
              />

              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email, only if you want a reply"
                className="border-st-secondary text-tx focus:border-tx w-full rounded-xl border bg-white px-3 py-2 text-[13.5px] outline-none transition-colors"
              />

              {err && <p className="mt-2 text-[12.5px] text-red-700">{err}</p>}

              <button
                onClick={() => void submit()}
                disabled={busy}
                className="pill pill-primary mt-2.5 w-full justify-center !py-2.5 !text-[14px] disabled:opacity-40"
              >
                {busy ? 'Sending…' : 'Send'}
              </button>
            </>
          )}
        </div>
      )}

      <button
        onClick={toggle}
        aria-expanded={open}
        aria-label={open ? 'Close feedback' : 'Send feedback'}
        className={`border-st-secondary flex items-center gap-2 rounded-full border py-2.5 pr-4 pl-3.5 text-[13px] font-medium shadow-[0_6px_20px_-6px_rgba(30,32,51,0.3)] transition-all duration-200 ${
          open ? 'bg-tx border-tx text-white' : 'text-tx hover:border-tx bg-white'
        }`}
      >
        <ChatIcon />
        Feedback
      </button>
    </div>
  )
}

function ChatIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2 6.2C2 4.4 3.4 3 5.2 3h5.6C12.6 3 14 4.4 14 6.2v2.6c0 1.8-1.4 3.2-3.2 3.2H7l-3 2v-2.2A3.2 3.2 0 0 1 2 8.8V6.2Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}
