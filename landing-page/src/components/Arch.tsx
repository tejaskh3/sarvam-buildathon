import { useId, type ReactNode } from 'react'

/* ------------------------------------------------------------------
   The scalloped medallion — sarvam.ai's "Experience Samvaad" tiles.

   A cusped lotus/Mughal arch: sixteen petals around a circle, with the
   four cardinal petals pulled out into pointed finials. Drawn rather
   than drafted by hand so the lobe count and proportions stay readable
   and adjustable, and so it scales to any size without an asset.
   ------------------------------------------------------------------ */

const TAU = Math.PI * 2
const LOBES = 16

/* Radii inside a 100×100 box centred on (50,50). The finial tip is the only
   point that lies ON the curve, so it alone sets the overall size and stops
   just short of the edge.
   PETAL is a Bézier control point, not a height: a quadratic only reaches about
   halfway to its control, so 52 draws a petal that crests near 41. Reading it
   as a radius is what made the first version render as a spiky compass rose. */
const VALLEY = 30 // the cusp between two petals
const PETAL = 45 // control point of an ordinary petal — a quadratic only reaches
//                  about halfway to its control, so this crests near 38/44
const FINIAL_SIDE = 42 // controls either side of a finial — below the tip, so the sides converge
const FINIAL_TIP = 47

/* The body is a squircle, not a circle. That is the whole silhouette: sarvam.ai's
   tile is a rounded SQUARE wearing scallops, so its corners reach ~19% further
   out than its edges do, and the four cardinal finials then spike back past the
   corners. Drawn on a constant radius it comes out a sunburst badge instead. */
const squircle = (a: number, n = 4) =>
  1 / (Math.abs(Math.cos(a)) ** n + Math.abs(Math.sin(a)) ** n) ** (1 / n)

function medallion(): string {
  const at = (angle: number, r: number, square = true) => {
    const d = r * (square ? squircle(angle) : 1)
    return `${(50 + d * Math.cos(angle)).toFixed(2)} ${(50 + d * Math.sin(angle)).toFixed(2)}`
  }

  const step = TAU / LOBES
  /* Begin half a step before 12 o'clock, so petal 0 is centred on the vertical
     axis and petals 0/4/8/12 land exactly on the four cardinal directions. */
  const start = -Math.PI / 2 - step / 2
  let d = `M ${at(start, VALLEY)}`

  for (let i = 0; i < LOBES; i++) {
    const mid = start + step * (i + 0.5)
    const end = start + step * (i + 1)
    if (i % (LOBES / 4) === 0) {
      /* The finials are measured from the centre, not off the squircle — they
         have to clear the corners to read as points rather than as four more
         petals, and at the cardinals the squircle factor is 1 anyway. */
      d += ` Q ${at(mid - step / 4, FINIAL_SIDE, false)} ${at(mid, FINIAL_TIP, false)}`
      d += ` Q ${at(mid + step / 4, FINIAL_SIDE, false)} ${at(end, VALLEY)}`
    } else {
      d += ` Q ${at(mid, PETAL)} ${at(end, VALLEY)}`
    }
  }
  return `${d} Z`
}

const PATH = medallion()

/* Sarvam runs one hue per tile — saturated at the rim, washing out to near
   white through the middle. These pairs come from our own token ramps so the
   medallions sit in the same palette as the rest of the page. */
const TONES = {
  purple: ['#6d5cf0', '#cdc7fb'],
  pink: ['#d94a8c', '#f8c6dd'],
  warm: ['#c08827', '#e6d3ba'],
  green: ['#83c040', '#c8e4b0'],
  indigo: ['#4250d5', '#c7d2fe'],
} as const

export type ArchTone = keyof typeof TONES

export function Arch({
  tone = 'purple',
  size = 200,
  children,
  className = '',
}: {
  tone?: ArchTone
  size?: number
  children?: ReactNode
  className?: string
}) {
  const id = useId()
  const [rim, mid] = TONES[tone]

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
        <defs>
          <radialGradient id={id} cx="50%" cy="56%" r="62%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="34%" stopColor={mid} />
            <stop offset="80%" stopColor={rim} />
            <stop offset="100%" stopColor={rim} />
          </radialGradient>
        </defs>
        <path d={PATH} fill={`url(#${id})`} />
      </svg>
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-[18%] text-center">
          {children}
        </div>
      )}
    </div>
  )
}
