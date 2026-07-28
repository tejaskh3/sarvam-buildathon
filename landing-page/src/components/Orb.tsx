import { useEffect, useRef } from 'react'

/* ------------------------------------------------------------------
   One orb, two voices.
     purple = the person is talking  (listening)
     pink    = Yaadein is talking     (speaking)
   Grey and still when nothing is happening.
   ------------------------------------------------------------------ */

export type Voice = 'idle' | 'listening' | 'speaking'

const N = 1800

/* [far particles, near particles] */
const palette: Record<Voice, [string, string]> = {
  listening: ['#a89bf7', '#5b47ec'], // purple
  /* pink reads lighter than purple at the same nominal tint, so it is
     mixed a shade deeper to carry equal weight on the off-white page */
  speaking: ['#e07dad', '#c22e6e'], // pink
  idle: ['#c9cad6', '#9b9dae'],
}

function makeParticles() {
  const pts: { x: number; y: number; z: number; fuzz: number; phase: number }[] = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    const th = golden * i
    const fuzz =
      1 + Math.pow(Math.random(), 6) * 0.9 + (Math.random() - 0.5) * 0.12
    pts.push({
      x: Math.cos(th) * r,
      y,
      z: Math.sin(th) * r,
      fuzz,
      phase: Math.random() * Math.PI * 2,
    })
  }
  return pts
}

export function Orb({
  voice,
  /** 0..1 live audio energy; omit to use a gentle synthetic pulse */
  levelRef,
  className = '',
}: {
  voice: Voice
  levelRef?: React.RefObject<number>
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const voiceRef = useRef<Voice>(voice)
  voiceRef.current = voice

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const pts = makeParticles()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let raf = 0
    let rot = 0
    let energy = 0
    /* colours ease between states so the switch never snaps */
    let rgb: [number, number, number][] = [
      hexToRgb(palette.idle[0]),
      hexToRgb(palette.idle[1]),
    ]

    const size = () => {
      const s = Math.max(canvas.clientWidth, 1)
      canvas.width = s * dpr
      canvas.height = s * dpr
    }
    size()
    const ro = new ResizeObserver(size)
    ro.observe(canvas)

    const draw = (t: number) => {
      const v = voiceRef.current
      const live = levelRef?.current
      const pulse =
        live !== undefined && live !== null
          ? live
          : Math.abs(Math.sin(t / 260)) * 0.5 + Math.abs(Math.sin(t / 90)) * 0.3

      const target =
        v === 'listening'
          ? 0.3 + pulse * 0.6
          : v === 'speaking'
            ? 0.28 + pulse * 0.8
            : 0.1 + 0.05 * Math.sin(t / 900)
      energy += (Math.min(target, 1.1) - energy) * 0.08
      rot += 0.0014

      const want = palette[v].map(hexToRgb) as [number, number, number][]
      rgb = rgb.map((c, i) =>
        c.map((ch, j) => ch + (want[i][j] - ch) * 0.06),
      ) as [number, number, number][]
      const far = css(rgb[0])
      const near = css(rgb[1])

      const w = canvas.width
      ctx.clearRect(0, 0, w, w)
      const cx = w / 2
      const R = w * 0.27 * (1 + energy * 0.22)
      const cos = Math.cos(rot)
      const sin = Math.sin(rot)

      for (const p of pts) {
        const x = p.x * cos - p.z * sin
        const z = p.x * sin + p.z * cos
        const jitter = 1 + Math.sin(t / 300 + p.phase) * 0.015 * (1 + energy * 3)
        const r = R * p.fuzz * jitter
        const depth = (z + 1) / 2
        /* the active colours need to actually read, so lift them off the
           page more than the resting grey */
        ctx.globalAlpha =
          v === 'idle' ? 0.12 + depth * 0.5 : 0.24 + depth * 0.68
        ctx.fillStyle = depth > 0.5 ? near : far
        const dot = (v === 'idle' ? 0.6 : 0.75) * dpr + depth * 0.9 * dpr
        ctx.fillRect(cx + x * r, cx + p.y * r * 0.96, dot, dot)
      }
      ctx.globalAlpha = 1
      if (!reduced) raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [levelRef])

  return <canvas ref={canvasRef} aria-hidden className={`aspect-square ${className}`} />
}

/* the label that sits under the orb */
export function VoiceLabel({ voice }: { voice: Voice }) {
  if (voice === 'idle') return null
  const listening = voice === 'listening'
  return (
    <span
      className={`inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] uppercase ${
        listening ? 'text-sr-purple-600' : 'text-sr-pink-600'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 animate-pulse rounded-full ${
          listening ? 'bg-sr-purple-600' : 'bg-sr-pink-600'
        }`}
      />
      {listening ? 'Listening' : 'Speaking'}
    </span>
  )
}

/* The label while Yaadein is thinking.

   This is what replaced the ack clips. There used to be a pre-rendered
   "achha…" the instant she stopped speaking, which covered the pause by
   answering before anything had been heard; the pause is silent now, and a
   silent pause on a screen with one orb and one button is indistinguishable
   from a broken one. So the waiting is shown rather than spoken — four bars
   riding the same `wave-bar` keyframe the rest of the site uses, staggered so
   they read as a travelling wave rather than four things blinking.

   Grey, not purple or pink. Those two colours mean a voice is active; this is
   the state where neither is, and borrowing one would say something is being
   said. role="status" so a screen reader hears the wait too — the bars are
   decoration and stay hidden from it. */
export function ThinkingLabel({ label }: { label: string }) {
  return (
    <span
      role="status"
      className="text-tx-tertiary inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] uppercase"
    >
      <span aria-hidden className="flex h-3 items-end gap-[2.5px]">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            /* -90ms apart: enough that the crest visibly travels left to
               right, short enough that all four never sit flat together and
               make it look stopped. */
            style={{ animationDelay: `${i * -90}ms` }}
            className="wave-bar bg-tx-tertiary/70 h-3 w-[2px] rounded-full"
          />
        ))}
      </span>
      {label}
    </span>
  )
}

function hexToRgb(h: string): [number, number, number] {
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ]
}

function css([r, g, b]: [number, number, number]) {
  return `rgb(${r | 0},${g | 0},${b | 0})`
}
