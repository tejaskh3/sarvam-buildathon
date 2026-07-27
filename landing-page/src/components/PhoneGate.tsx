import { useState } from 'react'
import { authFetch } from '../lib/auth'

/* ------------------------------------------------------------------
   Link a household to Yaadein.

   Identity is split on purpose:
   · the FAMILY signs in (Clerk) — that's who owns the dashboard
   · the ELDER is a phone number — they never log in, they just talk

   So this asks for the number the elder's device will use, and (for a
   new household) who the companion is for. The number is remembered on
   the device so an elder never sees this screen again.
   ------------------------------------------------------------------ */

export const TEST_PHONE = '1234567890'
const KEY = 'yaadein-phone'

export function getStoredPhone(): string | null {
  const p = localStorage.getItem(KEY)
  return p && /^\d{10}$/.test(p) ? p : null
}

export function clearStoredPhone() {
  localStorage.removeItem(KEY)
}

const LANGS: [string, string][] = [
  ['hi-IN', 'हिन्दी'],
  ['kn-IN', 'ಕನ್ನಡ'],
  ['ta-IN', 'தமிழ்'],
  ['te-IN', 'తెలుగు'],
  ['mr-IN', 'मराठी'],
  ['bn-IN', 'বাংলা'],
  ['gu-IN', 'ગુજરાતી'],
  ['ml-IN', 'മലയാളം'],
  ['pa-IN', 'ਪੰਜਾਬੀ'],
  ['od-IN', 'ଓଡ଼ିଆ'],
  ['en-IN', 'English'],
]

export function PhoneGate({
  api,
  onDone,
  onClose,
  forElder = false,
}: {
  api: string
  onDone: (phone: string) => void
  onClose?: () => void
  /* On the elder's own screen we must never present a form: someone with
     memory loss cannot type a 10-digit number. They get one big button for
     the shared demo, and a line telling them their family sets this up. */
  forElder?: boolean
}) {
  const [step, setStep] = useState<'phone' | 'details'>('phone')
  const [phone, setPhone] = useState('')
  const [elder, setElder] = useState('')
  const [lang, setLang] = useState('hi-IN')
  const [family, setFamily] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submitPhone = async () => {
    const n = phone.trim()
    if (!/^\d{10}$/.test(n)) {
      setErr('Please enter a 10-digit number.')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const r = await authFetch(`${api}/api/verify-phone?n=${n}`)
      const j = await r.json()
      if (j.ok) {
        localStorage.setItem(KEY, n) // already set up → straight in
        onDone(n)
      } else {
        setStep('details') // new household → one more step
      }
    } catch {
      setErr('Could not reach the server — check your connection.')
    } finally {
      setBusy(false)
    }
  }

  const submitDetails = async () => {
    if (!elder.trim()) {
      setErr('Please tell us their name — Yaadein greets them with it.')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const r = await authFetch(`${api}/api/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          elder_name: elder.trim(),
          language: lang,
          family_name: family.trim(),
          source: 'web',
        }),
      })
      const j = await r.json()
      if (!r.ok || !j.ok) throw new Error(j.message || 'Could not set this up.')
      localStorage.setItem(KEY, phone.trim())
      onDone(phone.trim())
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const input =
    'border-st-secondary text-tx focus:border-tx w-full rounded-xl border bg-white px-4 py-3 text-[16px] outline-none'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-5 backdrop-blur-sm">
      <div className="relative w-full max-w-[420px] rounded-2xl bg-white px-6 py-7 shadow-2xl">
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-tx-tertiary hover:text-tx absolute top-3.5 right-4 flex h-8 w-8 items-center justify-center rounded-full text-[20px] leading-none transition-colors"
          >
            ×
          </button>
        )}

        {forElder ? (
          <>
            <h2 className="font-season text-tx text-[22px]">Ready when you are</h2>
            <p className="text-tx-secondary mt-2 text-[15px] leading-relaxed">
              This phone hasn&apos;t been set up yet. Your family sends a link once, and after that Yaadein
              simply knows you.
            </p>
            <button
              onClick={() => {
                localStorage.setItem(KEY, TEST_PHONE)
                onDone(TEST_PHONE)
              }}
              className="pill pill-primary mt-5 w-full justify-center !py-3 !text-[15px]"
            >
              Try a conversation now
            </button>
            <p className="text-tx-tertiary mt-3 text-[12.5px] leading-relaxed">
              This uses a shared demo — anything said here is not private to your family.
            </p>
            <a href="#/family" className="text-sr-indigo-700 mt-4 block text-[13px] underline">
              I&apos;m the family — set this up properly
            </a>
          </>
        ) : step === 'phone' ? (
          <>
            <h2 className="font-season text-tx text-[22px]">Which number is this for?</h2>
            <p className="text-tx-secondary mt-1.5 text-[14px] leading-relaxed">
              Yaadein belongs to a phone number — the one your parent will talk on. Enter it to begin, or to
              come back to your family&apos;s memories.
            </p>
            <input
              autoFocus
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={10}
              placeholder="10-digit mobile number"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && void submitPhone()}
              className={input + ' mt-4 tracking-[0.08em]'}
            />
            {err && <p className="mt-2 text-[13px] text-red-700">{err}</p>}
            <button
              onClick={() => void submitPhone()}
              disabled={busy || phone.length !== 10}
              className="pill pill-primary mt-4 w-full justify-center !py-2.5 !text-[14px] disabled:opacity-40"
            >
              {busy ? 'Checking…' : 'Continue'}
            </button>
            <button
              onClick={() => setPhone(TEST_PHONE)}
              className="bg-sf-secondary text-tx-secondary hover:text-tx mt-3 w-full rounded-xl px-4 py-2.5 text-[13px] transition-colors"
            >
              Just exploring? Use the shared demo number:{' '}
              <span className="text-tx font-mono font-semibold">{TEST_PHONE}</span>
            </button>
          </>
        ) : (
          <>
            <h2 className="font-season text-tx text-[22px]">Who is Yaadein for?</h2>
            <p className="text-tx-secondary mt-1.5 text-[14px] leading-relaxed">
              So the very first hello is warm, and in the right language.
            </p>
            <div className="mt-4 space-y-3">
              <input
                autoFocus
                placeholder="Their name (e.g. Kamala)"
                value={elder}
                onChange={(e) => setElder(e.target.value)}
                className={input}
              />
              <select value={lang} onChange={(e) => setLang(e.target.value)} className={input}>
                {LANGS.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                placeholder="Your name (optional)"
                value={family}
                onChange={(e) => setFamily(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void submitDetails()}
                className={input}
              />
            </div>
            {err && <p className="mt-2 text-[13px] text-red-700">{err}</p>}
            <button
              onClick={() => void submitDetails()}
              disabled={busy}
              className="pill pill-primary mt-4 w-full justify-center !py-2.5 !text-[14px] disabled:opacity-40"
            >
              {busy ? 'Setting up…' : 'Start talking to Yaadein'}
            </button>
            <button
              onClick={() => setStep('phone')}
              className="text-tx-tertiary hover:text-tx mt-3 w-full text-[13px] transition-colors"
            >
              ← Different number
            </button>
          </>
        )}
      </div>
    </div>
  )
}
