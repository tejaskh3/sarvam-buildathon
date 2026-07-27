import { useEffect, type ReactNode } from 'react'
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignIn,
  UserButton,
  useAuth,
} from '@clerk/clerk-react'
import { CLERK_KEY, clerkConfigured, setTokenGetter } from '../lib/auth'

/* ------------------------------------------------------------------
   Sign-in / sign-out for the family. Everything here no-ops when Clerk
   isn't configured, so the app keeps working with no keys set.
   ------------------------------------------------------------------ */

/** Publishes Clerk's token getter to the plain fetch helpers. */
function AuthBridge({ children }: { children: ReactNode }) {
  const { getToken, isSignedIn } = useAuth()
  useEffect(() => {
    setTokenGetter(() => getToken())
    return () => setTokenGetter(null)
  }, [getToken, isSignedIn])
  return <>{children}</>
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (!clerkConfigured()) return <>{children}</>
  return (
    <ClerkProvider
      publishableKey={CLERK_KEY}
      afterSignOutUrl="/"
      appearance={{
        variables: {
          colorPrimary: '#6d5cf0',
          borderRadius: '0.75rem',
          fontFamily: 'inherit',
        },
      }}
    >
      <AuthBridge>{children}</AuthBridge>
    </ClerkProvider>
  )
}

/** The signed-in family member's avatar + sign-out menu. */
export function AccountButton() {
  if (!clerkConfigured()) return null
  return (
    <>
      <SignedIn>
        <UserButton
          afterSignOutUrl="/"
          appearance={{ elements: { avatarBox: 'h-8 w-8' } }}
        />
      </SignedIn>
      <SignedOut>
        <a href="#/family" className="pill pill-ghost !py-2 !text-[13px]">
          Sign in
        </a>
      </SignedOut>
    </>
  )
}

/**
 * Wraps the family dashboard. Signed out (and only when Clerk is configured),
 * it shows the sign-in card instead of the private data.
 */
export function RequireFamilySignIn({ children }: { children: ReactNode }) {
  if (!clerkConfigured()) return <>{children}</>
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <div className="mx-auto w-full max-w-[880px] px-5 py-12 sm:px-8">
          <h1 className="font-season text-tx text-[30px] tracking-tight">
            Sign in to see your family&apos;s memories
          </h1>
          <p className="text-tx-secondary mt-2 max-w-[560px] text-[15px] leading-relaxed">
            This page holds one person&apos;s life story — the things they told Yaadein, in their own words. It
            stays private to the family who set it up.
          </p>
          <p className="text-tx-tertiary mt-1.5 max-w-[560px] text-[13px] leading-relaxed">
            Your parent never has to sign in or remember anything. They just talk.
          </p>
          <div className="mt-7 flex justify-center sm:justify-start">
            <SignIn
              routing="virtual"
              appearance={{ elements: { rootBox: 'w-full max-w-[400px]', card: 'shadow-lg' } }}
            />
          </div>
        </div>
      </SignedOut>
    </>
  )
}
