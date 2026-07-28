import { useEffect, useState } from 'react'
import { Nav, Ticker } from './sections/Nav'
import { Hero } from './sections/Hero'
import { Personas } from './sections/Personas'
import { Loop } from './sections/Loop'
import { Experience } from './sections/Experience'
import { Coverage } from './sections/Coverage'
import { MobileApp } from './sections/MobileApp'
import { Pricing } from './sections/Pricing'
import { About } from './sections/About'
import { Footer } from './sections/Footer'
import { TryPage } from './try/TryPage'
import { FamilyPage } from './family/FamilyPage'
import { StatsPage } from './stats/StatsPage'
import { WaitlistPage } from './waitlist/WaitlistPage'

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
  if (route === '#/try') return <TryPage />
  if (route === '#/family') return <FamilyPage />
  if (route === '#/stats') return <StatsPage />
  if (route === '#/waitlist') return <WaitlistPage />

  return (
    <>
      <Ticker />
      <Nav />
      <main>
        <Hero />
        <Personas />
        <Loop />
        <Experience />
        <Coverage />
        <MobileApp />
        <Pricing />
        <About />
      </main>
      <Footer />
    </>
  )
}
