/* ------------------------------------------------------------------
   What the elder is allowed to be shown when something breaks.

   Both transports used to do this:

     setError(e instanceof Error ? e.message : String(e))

   …which put `NotAllowedError: Permission denied`, `Failed to fetch` and
   `stt 429: rate limit exceeded` in front of someone with memory loss, on
   the one screen in the product designed to ask nothing of them. Every
   other surface got written carefully; this one printed exception strings.

   So each failure becomes a sentence that says what happened and what to
   do about it, in the present tense, with no jargon and no blame. Two
   rules for anything added here:

   · Name the next action. A dead end is worse than an error.
   · Never imply their words were lost when they weren't. Finished turns
     are already saved server-side; only the sentence in flight is gone.

   Known gap, deliberately not faked: these are English. The elder may be
   talking to Yaadein in Tamil. Translating them needs the person's
   language on this screen — which the REST transport has and the realtime
   one does not — so it is a real task rather than a copy change.
   ------------------------------------------------------------------ */

/** True when the browser, not the product, is withholding the microphone. */
export function isMicBlocked(e: unknown): boolean {
  const name = (e as { name?: string })?.name || ''
  return name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError'
}

/**
 * A sentence the elder can act on. Falls back to something warm and
 * non-specific rather than leaking the underlying failure.
 */
export function elderError(e: unknown): string {
  const name = (e as { name?: string })?.name || ''
  const raw = e instanceof Error ? e.message : String(e ?? '')

  /* getUserMedia refusals. The first is by far the most common failure in
     the whole product: a browser voice app whose permission was declined. */
  if (isMicBlocked(e)) {
    return 'Yaadein cannot hear you yet — this browser is holding the microphone back. Allow the microphone for this page, then tap the circle again.'
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No microphone was found on this device. If you have headphones, plug them in and tap the circle again.'
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Something else on this device is using the microphone. Close it, then tap the circle again.'
  }

  /* fetch() rejects with a TypeError and no useful message when the network
     drops or the server is unreachable. */
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(raw)) {
    return 'The connection dropped. What you said before is safe — tap the circle when you are ready to carry on.'
  }

  /* Our own upstream limits, surfaced by the server as `stt 429: …` etc. */
  if (/\b429\b|rate limit|too many/i.test(raw)) {
    return 'Yaadein is talking to a lot of people just now. Wait a moment, then tap the circle again.'
  }
  if (/\b5\d\d\b|timeout|aborted/i.test(raw)) {
    return 'Yaadein is having trouble at our end, not yours. Tap the circle to try again in a moment.'
  }

  return 'Something went wrong at our end. What you said before is safe — tap the circle to try again.'
}
