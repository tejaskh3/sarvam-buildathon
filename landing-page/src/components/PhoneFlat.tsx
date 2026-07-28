/* ------------------------------------------------------------------
   The phone, drawn in CSS.

   This used to be the only version. It is now the fallback for <Phone3D/>:
   it renders while the three.js chunk is still downloading, if that chunk
   fails to arrive, and on any machine without WebGL. Same device, same one
   screen, so the swap is a gain in depth and never a change in content.

   Drawn, not screenshotted — a real screenshot of an app that does not
   exist yet would be a claim we can't back. It shows the one screen the
   elder ever sees, the orb and nothing else, because that is the product
   promise the app has to keep.
   ------------------------------------------------------------------ */

export function PhoneFlat() {
  return (
    <div className="border-st bg-tx relative w-[248px] rounded-[38px] border-[6px] p-1.5 shadow-[0_28px_70px_-24px_rgba(30,32,51,0.5)]">
      <div className="bg-sf relative overflow-hidden rounded-[30px] px-5 pt-9 pb-7">
        {/* notch */}
        <div className="bg-tx/85 absolute top-2.5 left-1/2 h-[18px] w-[74px] -translate-x-1/2 rounded-full" />

        <p className="text-tx-tertiary text-center font-mono text-[8px] tracking-[0.18em] uppercase">
          Aaj ki baithak
        </p>
        <p className="font-deva text-tx mt-1 text-center text-[15px] leading-none">यादें</p>

        {/* the orb, as concentric rings */}
        <div className="relative mx-auto mt-6 flex h-[112px] w-[112px] items-center justify-center">
          <span className="border-sr-indigo-200 absolute inset-0 rounded-full border" />
          <span className="border-sr-purple-200 absolute inset-[13px] rounded-full border" />
          <span
            className="absolute inset-[26px] rounded-full"
            style={{
              background:
                'radial-gradient(circle at 34% 30%, #a5b4fc 0%, #6d5cf0 58%, #4250d5 100%)',
            }}
          />
        </div>

        <p className="font-season text-tx mt-6 text-center text-[15px] leading-snug text-balance">
          “आपने पुणे का ज़िक्र किया था…”
        </p>

        {/* the mic — the only control, exactly as on the web page */}
        <div className="mt-6 flex justify-center">
          <span className="border-st-secondary flex h-[46px] w-[46px] items-center justify-center rounded-full border bg-white">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="9" y="3" width="6" height="11" rx="3" stroke="#1e2033" strokeWidth="1.8" />
              <path
                d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"
                stroke="#1e2033"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </div>
      </div>
    </div>
  )
}
