import { Suspense, lazy } from 'react'
import { TryPageRest } from './TryPageRest'

/* ------------------------------------------------------------------
   Two ways to hold a conversation, and one rule for choosing.

   TryPageRealtime is the better experience: a continuous Pipecat WebSocket
   session, so the microphone stays live and an elder can interrupt mid
   sentence. It needs a second service (`npm run realtime`) listening on
   another port.

   TryPageRest is the record-then-upload loop. Less natural, but it needs
   nothing except the Node server that already serves this page.

   The realtime path is used ONLY when VITE_REALTIME_URL is set at build
   time. That is deliberate: the deployed site is a single Node service on
   one port, so defaulting to `hostname:7860` would leave every visitor
   staring at a connection error where the demo used to be. Set the variable
   when a realtime service really is reachable; leave it unset and the site
   keeps the flow that has always worked.

   It is imported lazily because Pipecat's client and WebSocket transport are
   ~400KB. Statically importing them doubled the bundle for every visitor,
   including the ones on a phone in a small town who can never use realtime
   because production has no second service. Now that weight is a separate
   chunk nobody fetches unless the variable is set.
   ------------------------------------------------------------------ */
const REALTIME_URL = (import.meta.env.VITE_REALTIME_URL as string | undefined)?.trim()

const TryPageRealtime = lazy(() =>
  import('./TryPageRealtime').then((m) => ({ default: m.TryPageRealtime })),
)

export function TryPage() {
  if (!REALTIME_URL) return <TryPageRest />
  return (
    <Suspense fallback={null}>
      <TryPageRealtime />
    </Suspense>
  )
}
