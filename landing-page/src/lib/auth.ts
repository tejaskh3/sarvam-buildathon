/* ------------------------------------------------------------------
   Auth glue — Clerk, but optional.

   Who signs in: the FAMILY (the adult child who set Yaadein up).
   Who never signs in: the elder. They tap one button and talk; asking
   someone with memory loss to log in would be the whole product's
   contradiction. So the voice page stays number-based on the device,
   and only the family dashboard is behind a session.

   If VITE_CLERK_PUBLISHABLE_KEY is absent the app runs exactly as it
   did before — no provider, no sign-in wall.
   ------------------------------------------------------------------ */

export const CLERK_KEY = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined)?.trim() || ''
export const clerkConfigured = () => CLERK_KEY.startsWith('pk_')

/* The signed-in family member's token, refreshed by Clerk. Stashed here by
   <AuthBridge> so plain fetch helpers can reach it without prop-drilling
   through every dashboard component. */
let tokenGetter: (() => Promise<string | null>) | null = null

export function setTokenGetter(fn: (() => Promise<string | null>) | null) {
  tokenGetter = fn
}

/** fetch() with the family's session attached when there is one. */
export async function authFetch(url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {})
  if (tokenGetter) {
    try {
      const t = await tokenGetter()
      if (t) headers.set('Authorization', `Bearer ${t}`)
    } catch {
      /* expired session — the request will 401 and the UI will ask for sign-in */
    }
  }
  return fetch(url, { ...init, headers })
}

/** Same, but returns parsed JSON and throws a readable message on failure. */
export async function authJson<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const r = await authFetch(url, init)
  const text = await r.text()
  let body: Record<string, unknown> = {}
  try {
    body = text ? JSON.parse(text) : {}
  } catch {
    throw new Error('The server sent something unexpected.')
  }
  if (!r.ok) {
    throw new Error(
      (body.message as string) ||
        (body.error as string) ||
        `Request failed (${r.status})`,
    )
  }
  return body as T
}
