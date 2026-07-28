import { useEffect, useState } from 'react'
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
