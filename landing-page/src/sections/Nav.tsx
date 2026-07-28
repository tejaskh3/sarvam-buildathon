import { useEffect, useState } from 'react'
import { Logo } from '../components/Logo'
import { AccountButton, FamilyLink } from '../components/Auth'

/* ------------------------------------------------------------------
   A floating bar, and a shorter one.

   Two changes, and the second matters more than the first.

   It floats: a detached pill on a hairline border with a blurred
   translucent fill, rather than a full-bleed strip welded to the top of
   the page. That isn't a style departure — the site is already built from
   pills, 24px radii, #dedee0 hairlines and soft lifts, and the old bar was
   the one element ignoring all of it. Floating also fixes a real seam: the
   dark ticker met a solid `bg-sf` bar with a hard edge between them.

   And it lost two links. Eight text items in a row is a wall you scan
   rather than read, and no amount of glass fixes that. `#experience` and
   `#about` are still on the page, still linked from the footer, and still
   in the phone menu below — they were the two least likely to be the
   reason somebody came. What is left is the shape of the pitch: who it's
   for, how it works, the language claim, the price, and the cohort.
   ------------------------------------------------------------------ */

type Link = { href: string; label: string; accent?: boolean }

const links: Link[] = [
  { href: '#personas', label: 'Who this is for' },
  { href: '#loop', label: 'How it works' },
  { href: '#languages', label: '11 languages' },
  { href: '#app', label: 'The app' },
  { href: '#pricing', label: 'Pricing' },
  /* The bar has no room for another pill, so the one thing we most want
     clicked earns a dot instead of width. */
  { href: '#/waitlist', label: 'The first fifty', accent: true },
]

/* Everything the floating bar dropped, so the phone — which has room to
   scroll — still gets the full map. */
const menuOnly: Link[] = [
  { href: '#experience', label: 'How to use' },
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
    /* The sticky element is a transparent full-width wrapper; the visible bar
       is the pill inside it. Sticking the pill itself would make its own
       margins part of the sticky box and leave it flush to the top on scroll. */
    /* The gap above the pill tightens on scroll, and that is not just a flourish.
       A floating bar leaves a live sliver of page between the viewport top and
       its own top edge, and anything large passing through shows as a fragment —
       the 200px "11" in the languages band appeared as two white stubs either
       side of the pill. Docking closer roughly halves that sliver, and reads as
       the bar settling rather than hovering. */
    <header
      /* No transition on the padding. `transition-[padding]` here left the
         computed value pinned at its starting 16px — the animation never
         settled, so the bar simply never docked. Removing it makes the 8px
         change instant, which nobody can perceive anyway; the pill's own
         fill, blur and shadow still ease, and those are what read as motion. */
      className={`sticky top-0 z-50 px-3 sm:px-5 ${
        scrolled ? 'pt-1.5 sm:pt-2' : 'pt-3 sm:pt-4'
      }`}
    >
      <nav
        /* Opacity is a legibility constraint here, not a taste setting.
           At bg-white/75 the pill sampled whatever was behind it, so over the
           dark #languages band it turned into a muddy mid-grey slab and the ink
           text on it fell to roughly 2:1 contrast — "Sign in" was barely
           readable. The fill has to stay a LIGHT surface no matter what it
           floats over, which means high opacity; the blur is what keeps it
           feeling like glass rather than a solid chip. Don't lower these
           without checking the bar against the dark band. */
        className={`mx-auto flex w-full max-w-[1180px] items-center justify-between gap-2 rounded-full border py-2 pr-2 pl-4 transition-all duration-300 sm:pl-5 ${
          scrolled
            ? 'border-st-secondary/70 bg-white/92 shadow-[0_10px_34px_-14px_rgba(30,32,51,0.3)] backdrop-blur-xl backdrop-saturate-150'
            : 'border-st-secondary/50 bg-white/80 shadow-[0_4px_18px_-12px_rgba(30,32,51,0.18)] backdrop-blur-lg backdrop-saturate-150'
        }`}
      >
        <a href="#top" className="flex shrink-0 items-center gap-2.5">
          <Logo size={30} />
          <span className="font-season text-tx text-[19px] leading-none">
            Yaadein
          </span>
        </a>

        <div className="hidden items-center gap-5 lg:flex">
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

        {/* ONE filled pill in the bar.
            "For families" is quiet text (and becomes "Sign in" when signed
            out), "Try now" is the only filled control, and signed-in families
            get their avatar. On a phone just the CTA and the menu survive. */}
        <div className="flex shrink-0 items-center gap-2.5">
          <FamilyLink className="text-tx-secondary hover:text-tx hidden text-[13.5px] font-medium whitespace-nowrap transition-colors sm:inline-flex" />
          <a
            href="#/try"
            className="pill pill-primary !px-4 !py-[7px] !text-[13.5px] whitespace-nowrap"
          >
            Try now
          </a>
          {/* signed out, FamilyLink above is already the sign-in door */}
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
        className={`mx-auto grid w-full max-w-[1180px] overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:hidden ${
          open ? 'mt-2 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        } ${open ? '' : 'pointer-events-none'}`}
      >
        <div className="min-h-0">
          <div className="border-st-secondary/70 rounded-3xl border bg-white/90 px-5 py-3 shadow-[0_16px_40px_-18px_rgba(30,32,51,0.3)] backdrop-blur-xl">
            {[...links, ...menuOnly].map((l, i) => (
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
                {l.accent && (
                  <span className="bg-sr-green-600 h-1.5 w-1.5 rounded-full" />
                )}
                {l.label}
              </a>
            ))}
            {/* what the narrow bar had to give up, kept under a rule so it
                reads as "your account" rather than more page navigation */}
            <div
              style={{ transitionDelay: open ? `${60 + (links.length + menuOnly.length) * 35}ms` : '0ms' }}
              className={`border-st-secondary mt-1 border-t pt-1 transition-all duration-300 sm:hidden ${
                open ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'
              }`}
            >
              {/* One row, both states: "For families" signed in, "Sign in"
                  signed out. There used to be a separate sign-in row below
                  this one, which signed out meant two rows onto one dialog. */}
              <FamilyLink className="text-tx-secondary block py-2.5 text-[15px] font-medium" />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
