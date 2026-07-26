import { useState } from 'react'

/* ------------------------------------------------------------------
   No auth, just a number: chat and family pages open only for
   10-digit numbers on the server's allowlist. The shared test number
   is shown to everyone; team numbers stay private.
   The number is remembered on the device (localStorage) so a family
   enters it once.
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

export function PhoneGate({ api, onDone }: { api: string; onDone: (phone: string) => void }) {
  const [value, setValue] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const n = value.trim()
    if (!/^\d{10}$/.test(n)) {
      setErr('Please enter a 10-digit number.')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const r = await fetch(`${api}/api/verify-phone?n=${n}`)
      const j = await r.json()
      if (!j.ok) {
        setErr('This number is not on the Yaadein list yet — try the test number below.')
        return
      }
      localStorage.setItem(KEY, n)
      onDone(n)
    } catch {
      setErr('Could not reach the server. Is it running?')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-5 backdrop-blur-sm">
      <div className="w-full max-w-[400px] rounded-2xl bg-white px-6 py-7 shadow-2xl">
        <h2 className="font-season text-tx text-[22px]">Your Yaadein number</h2>
        <p className="text-tx-secondary mt-1.5 text-[14px] leading-relaxed">
          Conversations and memories belong to a phone number, so families stay private without a login.
        </p>
        <input
          autoFocus
          inputMode="numeric"
          maxLength={10}
          placeholder="10-digit number"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
          className="border-st-secondary text-tx focus:border-tx mt-4 w-full rounded-xl border bg-white px-4 py-3 text-[17px] tracking-[0.08em] outline-none"
        />
        {err && <p className="mt-2 text-[13px] text-red-700">{err}</p>}
        <button
          onClick={() => void submit()}
          disabled={busy || value.length !== 10}
          className="pill pill-primary mt-4 w-full justify-center !py-2.5 !text-[14px] disabled:opacity-40"
        >
          {busy ? 'Checking…' : 'Continue'}
        </button>
        <button
          onClick={() => setValue(TEST_PHONE)}
          className="bg-sf-secondary text-tx-secondary hover:text-tx mt-3 w-full rounded-xl px-4 py-2.5 text-[13px] transition-colors"
        >
          Just trying it out? Use the shared test number:{' '}
          <span className="text-tx font-mono font-semibold">{TEST_PHONE}</span>
        </button>
      </div>
    </div>
  )
}
