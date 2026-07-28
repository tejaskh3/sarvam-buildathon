import { useState } from 'react'
import { authFetch } from '../../lib/auth'
import { LangSelect } from '../../components/LangSelect'
import { API } from '../../lib/api'
import { TEST_PHONE } from '../../components/PhoneGate'

/* ------------------------------------------------------------------
   "You're signed in, but there's no parent set up yet."

   This replaced a modal titled "Which number is this for?" that appeared
   over the dashboard on arrival. Two things were wrong with it. It asked
   for a phone number seconds after you'd signed in with an email, without
   saying whose number or why — and being a modal, it implied you couldn't
   proceed, when in fact you could close it and browse.

   So: on the page, not over it. It leads with the answer to the obvious
   question — this is your PARENT's number, not yours, and it is their
   account because they will never log in — and it offers the demo as a
   real first-class option, because most people arriving here want to see
   the thing work before they involve their mother.
   ------------------------------------------------------------------ */

export function SetUpPanel({ onDone }: { onDone: (phone: string) => void }) {
  const [phone, setPhone] = useState('')
  const [elder, setElder] = useState('')
  const [lang, setLang] = useState('hi-IN')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    if (!/^\d{10}$/.test(phone.trim())) {
      setErr('That needs to be a 10-digit mobile number.')
      return
    }
    if (!elder.trim()) {
      setErr('Please add their name — Yaadein greets them with it.')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const r = await authFetch(`${API}/api/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          elder_name: elder.trim(),
          language: lang,
          source: 'web',
        }),
      })
      const j = await r.json()
      if (!r.ok || !j.ok) throw new Error(j.message || 'Could not set this up.')
      localStorage.setItem('yaadein-phone', phone.trim())
      onDone(phone.trim())
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const input =
    'border-st-secondary text-tx focus:border-tx w-full rounded-xl border bg-white px-4 py-3 text-[15px] outline-none transition-colors'

  return (
    <div className="mx-auto mt-8 max-w-[560px]">
      <p className="eyebrow flex items-center gap-2">
        <span className="bg-sr-green-600 h-1.5 w-1.5 rounded-full" />
        You&apos;re signed in
      </p>
      <h1 className="font-season text-tx mt-3 text-[30px] leading-tight tracking-tight text-balance sm:text-[34px]">
        One step left: connect your parent&apos;s phone.
      </h1>

      {/* The question the old modal never answered. */}
      <p className="text-tx-secondary mt-4 text-[15px] leading-relaxed text-pretty">
        Your account is <span className="text-tx">yours</span>. The conversations
        belong to <span className="text-tx">your parent&apos;s phone number</span> —
        because they never sign in. No password, no app, no account for them to
        remember. Their number is how Yaadein knows who it&apos;s talking to, and
        how this page finds their memories later.
      </p>

      {/* The returning-from-the-waitlist case, said out loud.
          A seat claimed with an email only cannot be linked to a Google account
          automatically — nothing connects the two, and trusting a
          browser-supplied address would let anyone claim a stranger's seat. So
          the number is the thing that reconnects them, and this line is what
          stops the page reading as "your signup vanished". It used to open with
          "Nothing here yet", which is exactly the wrong sentence for someone who
          filled in this number a week ago. */}
      <p className="border-st-secondary text-tx-secondary mt-4 rounded-xl border border-dashed bg-white px-4 py-3 text-[13.5px] leading-relaxed text-pretty">
        <span className="text-tx font-medium">Already claimed a seat</span> and told
        us their number then? Enter the same number below — nothing was lost, and
        it will pick up whatever they&apos;ve already said.
      </p>

      <div className="card mt-7 p-6">
        <p className="text-tx text-[15px] font-medium">
          Their number, and how to greet them
        </p>
        <p className="text-tx-tertiary mt-1 text-[13px] leading-relaxed">
          Takes about a minute. You can change any of it afterwards — and if
          they&apos;ve already talked to Yaadein, their memories are waiting.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-tx-secondary mb-1.5 block text-[13px]">
              Their mobile number
            </label>
            <input
              inputMode="numeric"
              /* NOT autoComplete="tel-national". This is the parent's number, not
                 the person typing — and on Chrome that hint pops the browser's
                 identity autofill, offering to fill in Aadhaar and business
                 cards. Alarming, and never the right value. */
              autoComplete="off"
              maxLength={10}
              placeholder="10-digit mobile number"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              className={input + ' tracking-[0.08em]'}
            />
          </div>
          <div>
            <label className="text-tx-secondary mb-1.5 block text-[13px]">
              What should Yaadein call them?
            </label>
            <input
              placeholder="e.g. Kamala, or Amma"
              value={elder}
              onChange={(e) => setElder(e.target.value)}
              className={input}
            />
          </div>
          <div>
            <label className="text-tx-secondary mb-1.5 block text-[13px]">
              Which language do they speak at home?
            </label>
            <LangSelect value={lang} onChange={setLang} />
          </div>
        </div>

        {err && <p className="mt-3 text-[13px] text-red-700">{err}</p>}

        <button
          onClick={() => void submit()}
          disabled={busy}
          className="pill pill-primary mt-5 w-full justify-center !py-3 !text-[15px] disabled:opacity-40"
        >
          {busy ? 'Setting up…' : 'Set up and get their link'}
        </button>
      </div>

      {/* Not a footnote. Most people arriving here want to hear it work before
          they hand anything to their mother. */}
      <div className="border-st-secondary mt-5 rounded-2xl border bg-white p-5">
        <p className="text-tx text-[15px] font-medium">
          Or just hear it talk first
        </p>
        <p className="text-tx-secondary mt-1 text-[13.5px] leading-relaxed text-pretty">
          Talking to Yaadein opens a private demo on your device — nobody else hears
          it. The dashboard below is a prepared example household, so there is
          something to look at before your parent has said a word.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href="#/try" className="pill pill-ghost !py-2.5 !text-[14px]">
            Talk to Yaadein
          </a>
          <button
            onClick={() => {
              localStorage.setItem('yaadein-phone', TEST_PHONE)
              onDone(TEST_PHONE)
            }}
            className="pill pill-ghost !py-2.5 !text-[14px]"
          >
            Show me the demo dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
