import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Nav, Ticker } from './sections/Nav'
import { Hero } from './sections/Hero'
import { Personas } from './sections/Personas'
import { Loop } from './sections/Loop'
import { Experience } from './sections/Experience'
import { Coverage } from './sections/Coverage'
import { Languages } from './sections/Languages'
import { MobileApp } from './sections/MobileApp'
import { Pricing } from './sections/Pricing'
import { About } from './sections/About'
import { Footer } from './sections/Footer'
import { TryPage } from './try/TryPage'
import { FamilyPage } from './family/FamilyPage'
import { StatsPage } from './stats/StatsPage'
import { WaitlistPage } from './waitlist/WaitlistPage'
import { FeedbackButton } from './components/FeedbackButton'

export default function App() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  /* match the route only, so a setup link like #/try?n=9876543210 still routes
     (exact matching silently dropped anyone arriving with a parameter) */
  const route = hash.split('?')[0]

  /* Which of the four pages this route renders. Anchors like #pricing and
     #app are not pages — they are positions on the home page — so they all
     resolve to 'home'. Only a change in THIS value means a different component
     mounted, and only then is the scroll position ours to set. */
  const page = route.startsWith('#/') ? route : '#/home'

  /* Where a hash change actually leaves you.

     Nothing in the DOM has the id "/waitlist", so the browser's own anchor
     scroll finds no target and quietly does nothing — you keep the offset you
     had on the page you left and arrive that far down the new one, at a point
     that reads as random because it is. Its mirror: clicking "Pricing" from
     the waitlist DOES name a real anchor, but #pricing has not mounted at
     hashchange time, so that scroll misses too and dumps you at the top of the
     home page instead. One bug — the browser scrolls before React renders —
     so it is answered once, here, after the render and before the paint.

     Two things this must NOT do. It must not touch same-page anchors: on the
     home page the browser already handles #pricing correctly and smoothly, and
     `page` staying equal is what keeps us out of the way. And it must not run
     on the first render, where the browser has already honoured the incoming
     anchor or restored the scroll position of a refresh — neither is ours to
     overrule. */
  const lastPage = useRef<string | null>(null)
  useLayoutEffect(() => {
    const changed = lastPage.current !== null && lastPage.current !== page
    lastPage.current = page
    if (!changed) return

    /* 'instant' is load-bearing twice over, not a preference.
       html sets scroll-behavior: smooth, and an inherited-smooth scrollIntoView
       is a silent no-op from here — verified: the call returns having moved
       nothing, while the same call with an explicit behavior lands exactly on
       target. Passing it also spares anyone crossing pages an animated flight
       through nine thousand pixels of a page they just left. */
    const behavior = 'instant' as ScrollBehavior

    /* A named anchor on the page we just arrived at — now that it exists.
       scrollIntoView, not scrollTo, because the anchors carry
       scroll-margin-top: 72px to clear the floating nav, and only
       scrollIntoView honours it. */
    const target = route.startsWith('#/') ? null : document.getElementById(route.slice(1))
    if (target) target.scrollIntoView({ behavior })
    else window.scrollTo({ top: 0, behavior })
  }, [page, route])

  /* The elder's screen gets NO feedback button, and that is the point of
     handling it here rather than inside each page. Their surface is one orb and
     one button; a floating "Feedback" pill in English, asking someone with
     memory loss to critique software, would undo the whole design. Everyone
     else — families, centre staff, judges — sees it. */
  if (route === '#/try') return <TryPage />
  if (route === '#/family') return <Chrome><FamilyPage /></Chrome>
  if (route === '#/stats') return <Chrome><StatsPage /></Chrome>
  if (route === '#/waitlist') return <Chrome><WaitlistPage /></Chrome>

  return (
    <Chrome>
      <Ticker />
      <Nav />
      <main>
        <Hero />
        <Personas />
        <Loop />
        <Experience />
        {/* Straight after "how to use it", before the family features: the
            language question is the first thing an Indian family actually
            asks, and it is the loudest thing Sarvam gives us. */}
        <Languages />
        <Coverage />
        <MobileApp />
        <Pricing />
        <About />
      </main>
      <Footer />
    </Chrome>
  )
}

/** Everything that floats above a page, for every page except the elder's. */
function Chrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <FeedbackButton />
    </>
  )
}
