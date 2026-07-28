/* ------------------------------------------------------------------
   Where the agent server lives.

   Seven files used to carry a byte-identical copy of this expression,
   each with its own copy of the warning below. One of them drifting
   would have been invisible until something broke in production, so it
   lives here once.
   ------------------------------------------------------------------ */

/* ⚠ DO NOT hardcode localhost as the production fallback.
   In production the Node server serves the page AND /api/* on the same
   origin, so this must be '' (relative). localhost is for `vite dev`
   only — an unconditional localhost fallback breaks the deployed site
   for everyone except the machine it was built on. */
export const API =
  (import.meta.env.VITE_API_BASE as string | undefined) ??
  (import.meta.env.DEV ? 'http://localhost:3000' : '')
