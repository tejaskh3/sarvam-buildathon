import { useEffect, useMemo, useState } from 'react'

/* ------------------------------------------------------------------
   A one-shot confetti burst. Mount it and it falls once, then removes
   itself from the DOM rather than leaving 90 absolutely-positioned
   nodes sitting over the page forever.

   Hand-rolled rather than pulled from npm: it's one keyframe and a
   loop, and this is the only place in the app that celebrates
   anything. Not worth a dependency.
   ------------------------------------------------------------------ */

/* The palette, straight off our own token ramps. */
const COLORS = ['#6d5cf0', '#d94a8c', '#c08827', '#83c040', '#4250d5', '#e6d3ba']

const LIFETIME_MS = 4200

export function Confetti({ pieces = 90 }: { pieces?: number }) {
  /* Somebody who has asked for less motion gets none of this. The global
     reduced-motion rule would otherwise collapse the fall to 0.001ms, which
     reads as a flicker rather than as nothing happening. */
  const calm =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const [gone, setGone] = useState(false)

  useEffect(() => {
    if (calm) return
    const t = setTimeout(() => setGone(true), LIFETIME_MS)
    return () => clearTimeout(t)
  }, [calm])

  const bits = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        left: Math.random() * 100,
        drift: `${(Math.random() - 0.5) * 240}px`,
        spin: `${(Math.random() - 0.5) * 1080}deg`,
        dur: `${2000 + Math.random() * 1700}ms`,
        delay: `${Math.random() * 320}ms`,
        w: 5 + Math.random() * 6,
        h: 9 + Math.random() * 8,
        color: COLORS[i % COLORS.length],
        round: i % 5 === 0,
      })),
    [pieces],
  )

  if (calm || gone) return null

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[90] overflow-hidden">
      {bits.map((b, i) => (
        <span
          key={i}
          className="confetti-bit absolute top-0"
          style={
            {
              left: `${b.left}%`,
              width: b.w,
              height: b.round ? b.w : b.h,
              borderRadius: b.round ? '50%' : 2,
              background: b.color,
              '--drift': b.drift,
              '--spin': b.spin,
              '--dur': b.dur,
              '--delay': b.delay,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}
