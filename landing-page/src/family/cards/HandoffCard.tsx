import { useState } from 'react'

/* The handoff: the family sets Yaadein up, their parent talks on another
   phone. */

/* ── handing the device to the elder ──────────────────────────────
   The family sets Yaadein up on their own phone, but their parent talks
   on a different one. Typing a 10-digit number is exactly what someone
   with memory loss cannot do — so the family sends a link that sets that
   phone up in one tap, forever. This card is that handoff. */

export function HandoffCard({ phone }: { phone: string }) {
  const [copied, setCopied] = useState(false)
  const link = `${window.location.origin}/#/try?n=${phone}`
  const waText = encodeURIComponent(
    `Maa, ye link kholiye — Yaadein aapse roz baat karegi, aapki hi bhasha mein. Bas ek baar kholna hai:\n${link}`,
  )

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="border-sr-indigo-700/25 bg-sr-indigo-700/[0.04] mt-6 rounded-2xl border px-6 py-5">
      <p className="text-sr-indigo-700 font-mono text-[9px] tracking-[0.16em] uppercase">One step left</p>
      <h2 className="font-season text-tx mt-1.5 text-[21px]">Set up your parent&apos;s phone</h2>
      <p className="text-tx-secondary mt-2 max-w-[620px] text-[14.5px] leading-relaxed">
        Send them this link. When they open it once, their phone is set up for good — no number to type, no
        password, nothing to remember. After that they only ever see one button, and they talk.
      </p>

      <div className="border-st-secondary mt-4 flex flex-wrap items-center gap-2 rounded-xl border bg-white px-3 py-2">
        <code className="text-tx-secondary flex-1 overflow-x-auto text-[12px] whitespace-nowrap">{link}</code>
        <button onClick={() => void copy()} className="pill pill-ghost !py-1.5 !text-[12px]">
          {copied ? 'Copied ✓' : 'Copy link'}
        </button>
        <a
          href={`https://wa.me/?text=${waText}`}
          target="_blank"
          rel="noreferrer"
          className="pill pill-primary !py-1.5 !text-[12px]"
        >
          Send on WhatsApp
        </a>
      </div>

      <ol className="text-tx-secondary mt-4 max-w-[620px] space-y-1.5 text-[13.5px] leading-relaxed">
        <li>1. Send the link to the phone your parent will use (or open it on their phone yourself).</li>
        <li>2. Ask them to tap the microphone once and allow the mic.</li>
        <li>3. Yaadein greets them by name and starts talking. Come back here afterwards — this page fills up
          with what they said.</li>
      </ol>
      <p className="text-tx-tertiary mt-3 text-[11.5px]">
        Anyone with this link can talk to Yaadein as your parent, so send it only to them. Your own dashboard
        stays behind your sign-in.
      </p>
    </section>
  )
}
