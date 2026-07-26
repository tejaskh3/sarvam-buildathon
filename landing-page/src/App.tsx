import { useEffect, useState } from 'react'
import { Nav, Ticker } from './sections/Nav'
import { Hero } from './sections/Hero'
import { Personas } from './sections/Personas'
import { Loop } from './sections/Contract'
import { Experience } from './sections/Flow'
import { Coverage } from './sections/Coverage'
import { Footer } from './sections/Footer'
import { TryPage } from './try/TryPage'

export default function App() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (hash === '#/try') return <TryPage />

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
      </main>
      <Footer />
    </>
  )
}
