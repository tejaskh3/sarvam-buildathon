import { useEffect, useRef } from 'react'

/* The same particle orb the live demo uses, driven by a state prop
   instead of real microphone level. */

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking'

const N = 1800

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
  state,
  className = '',
}: {
  state: OrbState
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<OrbState>(state)
  stateRef.current = state

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

    const size = () => {
      const s = Math.max(canvas.clientWidth, 1)
      canvas.width = s * dpr
      canvas.height = s * dpr
    }
    size()
    const ro = new ResizeObserver(size)
    ro.observe(canvas)

    const draw = (t: number) => {
      const s = stateRef.current
      // a gentle synthetic "voice level" so the orb breathes per state
      const pulse = Math.abs(Math.sin(t / 260)) * 0.5 + Math.abs(Math.sin(t / 90)) * 0.3
      const target =
        s === 'listening'
          ? 0.3 + pulse * 0.55
          : s === 'speaking'
            ? 0.28 + pulse * 0.75
            : s === 'thinking'
              ? 0.4 + 0.15 * Math.sin(t / 180)
              : 0.1 + 0.05 * Math.sin(t / 900)
      energy += (Math.min(target, 1.1) - energy) * 0.08
      rot += s === 'thinking' ? 0.004 : 0.0012

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
        ctx.globalAlpha = 0.12 + depth * 0.55
        ctx.fillStyle = depth > 0.5 ? '#4f46e5' : '#818cf8'
        const dot = (0.6 + depth * 0.9) * dpr
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
  }, [])

  return <canvas ref={canvasRef} aria-hidden className={`aspect-square ${className}`} />
}
