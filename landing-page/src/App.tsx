import { useEffect, useState } from 'react'
import { Nav, Ticker } from './sections/Nav'
import { Hero } from './sections/Hero'
import { Personas } from './sections/Personas'
import { Contract } from './sections/Contract'
import { Flow } from './sections/Flow'
import { Integrity } from './sections/Integrity'
import { Stories } from './sections/Stories'
import { Coverage } from './sections/Coverage'
import { Done } from './sections/Done'
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
        <Contract />
        <Flow />
        <Integrity />
        <Stories />
        <Coverage />
        <Done />
      </main>
      <Footer />
    </>
  )
}
