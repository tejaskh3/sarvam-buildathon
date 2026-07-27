import { useEffect, useState } from 'react'
import { Logo } from '../components/Logo'
import { AccountButton, SignInMenuItem } from '../components/Auth'

const links = [
  { href: '#personas', label: 'Who this is for' },
  { href: '#loop', label: 'How we remember' },
  { href: '#experience', label: 'How to use' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#about', label: 'About us' },
]

export function Ticker() {
  const item = (
    <span className="flex items-center gap-3 px-6 font-mono text-[10px] tracking-[0.16em] whitespace-nowrap text-white/70 uppercase">
      Yaadein
      <span className="text-sr-indigo-300">·</span>
      A voice companion for elders living with memory loss
      <span className="text-sr-indigo-300">·</span>
      Speaks every Indian language
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
      <nav className="mx-auto flex w-full max-w-[1180px] items-center justify-between gap-2 px-5 py-3.5 sm:px-8">
        <a href="#top" className="flex shrink-0 items-center gap-2.5">
          <Logo size={34} />
          <span className="font-season text-tx text-[20px] leading-none">
            Yaadein
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

        {/* A phone fits the logo, ONE call to action, and the menu — nothing
            more. Squeezing "Try now" and "Sign in" in alongside wrapped both
            onto two lines and broke the bar, so below sm the sign-in pill moves
            into the menu below and only "Try now" stays. whitespace-nowrap is
            what stops a pill from ever folding its label again. */}
        <div className="flex shrink-0 items-center gap-2">
          <a
            href="#/family"
            className="pill pill-ghost hidden !py-2 !text-[13px] whitespace-nowrap sm:inline-flex"
          >
            For families
          </a>
          <a href="#/try" className="pill pill-primary !py-2 !text-[13px] whitespace-nowrap">
            Try now
          </a>
          <AccountButton signInClass="pill pill-ghost hidden !py-2 !text-[13px] whitespace-nowrap sm:inline-flex" />
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
          {/* the two the narrow bar had to give up */}
          <a
            href="#/family"
            onClick={() => setOpen(false)}
            className="text-tx-secondary block py-2.5 text-[15px] font-medium sm:hidden"
          >
            For families
          </a>
          <SignInMenuItem className="text-tx-secondary block py-2.5 text-left text-[15px] font-medium sm:hidden" />
        </div>
      )}
    </header>
  )
}

