import {
  useEffect,
  useRef,
  useState,
  type ElementType,
  type ReactNode,
} from 'react'
import type { ContractKey, Priority } from '../data'

/* Fades a block in the first time it enters the viewport. */
export function Reveal({
  children,
  delay = 0,
  as: Tag = 'div',
  className = '',
}: {
  children: ReactNode
  delay?: number
  as?: ElementType
  className?: string
}) {
  const ref = useRef<HTMLElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    /* Anything already on screen at mount shows straight away, so a
       throttled/backgrounded tab can never leave the page blank. */
    if (el.getBoundingClientRect().top < window.innerHeight) {
      setShown(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <Tag
      ref={ref}
      className={`${className} ${shown ? 'reveal' : 'opacity-0'}`}
      style={shown ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  )
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>
}

export function Section({
  id,
  children,
  className = '',
  tone = 'sf',
}: {
  id?: string
  children: ReactNode
  className?: string
  tone?: 'sf' | 'white' | 'ink'
}) {
  const bg =
    tone === 'white' ? 'bg-white' : tone === 'ink' ? 'bg-tx text-white' : 'bg-sf'
  return (
    <section id={id} className={`${bg} ${className}`}>
      <div className="mx-auto w-full max-w-[1180px] px-5 py-20 sm:px-8 sm:py-28">
        {children}
      </div>
    </section>
  )
}

export function SectionHead({
  eyebrow,
  title,
  lede,
  invert = false,
  align = 'left',
}: {
  eyebrow: string
  title: ReactNode
  lede?: ReactNode
  invert?: boolean
  align?: 'left' | 'center'
}) {
  return (
    <Reveal
      className={`mb-12 max-w-3xl ${align === 'center' ? 'mx-auto text-center' : ''}`}
    >
      <p
        className={`eyebrow ${invert ? '!text-white/45' : ''} mb-4 flex items-center gap-2 ${
          align === 'center' ? 'justify-center' : ''
        }`}
      >
        <span
          className={`inline-block h-1 w-1 rounded-full ${
            invert ? 'bg-sr-indigo-300' : 'bg-sr-indigo-600'
          }`}
        />
        {eyebrow}
      </p>
      <h2
        className={`font-season text-[34px] leading-[1.08] tracking-[-0.01em] text-balance sm:text-[46px] ${
          invert ? 'text-white' : 'text-tx'
        }`}
      >
        {title}
      </h2>
      {lede && (
        <p
          className={`mt-5 text-[17px] leading-relaxed text-pretty ${
            invert ? 'text-white/60' : 'text-tx-tertiary'
          }`}
        >
          {lede}
        </p>
      )}
    </Reveal>
  )
}

const contractTone: Record<ContractKey, string> = {
  RESUMED: 'bg-sr-indigo-50 text-sr-indigo-700 border-sr-indigo-200',
  CAPTURED: 'bg-sr-indigo-50 text-sr-indigo-700 border-sr-indigo-200',
  CLOSED: 'bg-sr-warm-50 text-sr-warm-900 border-sr-warm-200',
  WRITTEN: 'bg-sr-warm-50 text-sr-warm-900 border-sr-warm-200',
  SAFE: 'bg-sr-green-50 text-sr-green-800 border-sr-green-200',
  ENGAGED: 'bg-sr-green-50 text-sr-green-800 border-sr-green-200',
}

export function ContractBadge({
  label,
  className = '',
}: {
  label: ContractKey
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[9px] tracking-[0.14em] ${contractTone[label]} ${className}`}
    >
      {label}
    </span>
  )
}

const priorityTone: Record<Priority, string> = {
  P0: 'bg-tx text-white',
  P1: 'bg-sf-secondary text-tx-secondary',
  P2: 'bg-white text-tx-tertiary border border-st-secondary',
}

export function PriorityTag({ p }: { p: Priority }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-[3px] font-mono text-[9px] tracking-[0.1em] ${priorityTone[p]}`}
    >
      {p}
    </span>
  )
}

export const toneRing: Record<string, string> = {
  warm: 'bg-sr-warm-50 text-sr-warm-900 border-sr-warm-200',
  indigo: 'bg-sr-indigo-50 text-sr-indigo-700 border-sr-indigo-200',
  green: 'bg-sr-green-50 text-sr-green-800 border-sr-green-200',
  rose: 'bg-sr-rose-100 text-sr-rose-600 border-sr-rose-100',
}
