import { useEffect, useState } from 'react'

const links = [
  { href: '#personas', label: 'Who it’s for' },
  { href: '#loop', label: 'How it remembers' },
  { href: '#experience', label: 'What it’s like' },
  { href: '#family', label: 'For the family' },
]

export function Ticker() {
  const item = (
    <span className="flex items-center gap-3 px-6 font-mono text-[10px] tracking-[0.16em] whitespace-nowrap text-white/70 uppercase">
      यादें · Yaadein
      <span className="text-sr-indigo-300">·</span>
      A voice companion for elders living with memory loss
      <span className="text-sr-indigo-300">·</span>
      Speaks Hindi, English & mixed
      <span className="text-sr-indigo-300">·</span>
      Built on Sarvam
      <span className="text-sr-indigo-300">·</span>
    </span>
  )
  return (
    <div className="bg-tx overflow-hidden py-2.5">
      <div className="animate-ticker flex w-max">
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} className="flex">
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        scrolled
          ? 'border-st-secondary border-b bg-white/85 backdrop-blur-xl'
          : 'border-b border-transparent'
      }`}
    >
      <nav className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-5 py-3.5 sm:px-8">
        <a href="#top" className="flex items-center gap-2.5">
          <span className="bg-tx flex h-8 w-8 items-center justify-center rounded-[9px]">
            <Mark />
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="font-deva text-tx text-[19px] leading-none">यादें</span>
            <span className="text-tx-tertiary text-[13px] font-medium tracking-tight">
              Yaadein
            </span>
          </span>
        </a>

        <div className="hidden items-center gap-7 lg:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-tx-secondary hover:text-tx text-[14px] font-medium transition-colors"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <a href="#demo" className="pill pill-ghost hidden !py-2 !text-[13px] sm:inline-flex">
            Watch a session
          </a>
          <a href="#/try" className="pill pill-primary !py-2 !text-[13px]">
            Try now
          </a>
          <button
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="border-st-secondary ml-1 flex h-9 w-9 items-center justify-center rounded-full border lg:hidden"
          >
            <span className="flex flex-col gap-[3px]">
              <span className="bg-tx block h-[1.5px] w-3.5" />
              <span className="bg-tx block h-[1.5px] w-3.5" />
            </span>
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-st-secondary border-t bg-white px-5 py-3 lg:hidden">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="text-tx-secondary block py-2.5 text-[15px] font-medium"
            >
              {l.label}
            </a>
          ))}
        </div>
      )}
    </header>
  )
}

function Mark() {
  return (
    <svg width="18" height="18" viewBox="0 0 32 32" fill="none" aria-hidden>
      <path
        d="M9 11.5v4.2c0 2.2 1.5 3.6 3.6 3.6s3.6-1.4 3.6-3.6v-4.2M16.2 15.7c0 2.2 1.5 3.6 3.6 3.6s3.6-1.4 3.6-3.6v-4.2"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="16" cy="23.5" r="1.5" fill="#818cf8" />
    </svg>
  )
}
