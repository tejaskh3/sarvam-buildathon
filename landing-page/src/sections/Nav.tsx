import { useEffect, useState } from 'react'
import { Logo } from '../components/Logo'
import { AccountButton, SignInMenuItem } from '../components/Auth'

const links = [
  { href: '#personas', label: 'Who this is for' },
  { href: '#loop', label: 'How we remember' },
  { href: '#experience', label: 'How to use' },
  { href: '#pricing', label: 'Pricing' },
  /* The bar has no room for another pill (see the note by the buttons), so the
     one thing we most want clicked earns a dot instead of width. */
  { href: '#/waitlist', label: 'The first fifty', accent: true },
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

        <div className="hidden items-center gap-6 lg:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={`flex items-center gap-1.5 text-[13.5px] font-medium whitespace-nowrap transition-colors ${
                l.accent ? 'text-sr-indigo-700 hover:text-tx' : 'text-tx-secondary hover:text-tx'
              }`}
            >
              {/* Static, not pulsing. A dot throbbing forever in a navigation
                  bar reads as an alarm; the pulse belongs to the live session
                  indicator, where something is actually happening. */}
              {l.accent && <span className="bg-sr-green-600 h-1.5 w-1.5 rounded-full" />}
              {l.label}
            </a>
          ))}
        </div>

        {/* ONE pill in the bar.

            It used to carry three — "For families", "Try now", "Sign in" — a
            white/dark/white sandwich that made the whole row look bitty, and
            two of them went to the same place: #/family opens the sign-in
            modal by itself, so a separate "Sign in" was a second door onto one
            room. Now the family route is quiet text, "Try now" is the only
            filled control, and signed-in families get their avatar. On a phone
            just the CTA and the menu survive. */}
        <div className="flex shrink-0 items-center gap-3">
          <a
            href="#/family"
            className="text-tx-secondary hover:text-tx hidden text-[13.5px] font-medium whitespace-nowrap transition-colors sm:inline-flex"
          >
            For families
          </a>
          <a
            href="#/try"
            className="pill pill-primary !px-4 !py-[7px] !text-[13.5px] whitespace-nowrap"
          >
            Try now
          </a>
          {/* signed out, "For families" above is the way in — no second button */}
          <AccountButton signInClass={null} />
          <button
            aria-label={open ? 'Close menu' : 'Menu'}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
            className="border-st-secondary hover:border-tx flex h-9 w-9 items-center justify-center rounded-full border transition-colors lg:hidden"
          >
            {/* the bars become an X when open, so the control says what it does */}
            <span className="relative flex h-[9px] w-3.5 flex-col justify-between">
              <span
                className={`bg-tx absolute block h-[1.5px] w-3.5 transition-transform duration-200 ${
                  open ? 'top-1/2 rotate-45' : 'top-0'
                }`}
              />
              <span
                className={`bg-tx absolute block h-[1.5px] w-3.5 transition-transform duration-200 ${
                  open ? 'top-1/2 -rotate-45' : 'top-full'
                }`}
              />
            </span>
          </button>
        </div>
      </nav>

      {/* The panel stays mounted and animates open, rather than being
          conditionally rendered — mounting can't be transitioned, which is why
          it used to appear all at once.

          Height is animated with grid-template-rows 0fr → 1fr: the one way to
          ease to a height nobody has measured. max-height would need a magic
          number that clips the menu the day a link is added. The inner wrapper
          needs min-h-0 or the grid row refuses to shrink below its content. */}
      <div
        id="mobile-menu"
        aria-hidden={!open}
        className={`grid overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:hidden ${
          open ? 'grid-rows-[1fr] opacity-100' : 'pointer-events-none grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="min-h-0">
          <div className="border-st-secondary border-t bg-white px-5 py-2">
            {links.map((l, i) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                /* each row arrives a beat after the one above, so the list
                   unfolds instead of materialising */
                style={{ transitionDelay: open ? `${60 + i * 35}ms` : '0ms' }}
                className={`flex items-center gap-2 py-2.5 text-[15px] font-medium transition-all duration-300 ${
                  open ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'
                } ${l.accent ? 'text-sr-indigo-700' : 'text-tx-secondary'}`}
              >
                {l.accent && <span className="bg-sr-green-600 h-1.5 w-1.5 rounded-full" />}
                {l.label}
              </a>
            ))}
            {/* what the narrow bar had to give up, kept together under a rule so
                it reads as "your account" rather than more page navigation */}
            <div
              style={{ transitionDelay: open ? `${60 + links.length * 35}ms` : '0ms' }}
              className={`border-st-secondary mt-1 border-t pt-1 transition-all duration-300 sm:hidden ${
                open ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'
              }`}
            >
              <a
                href="#/family"
                onClick={() => setOpen(false)}
                className="text-tx-secondary block py-2.5 text-[15px] font-medium"
              >
                For families
              </a>
              <SignInMenuItem className="text-tx-secondary block py-2.5 text-left text-[15px] font-medium" />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

