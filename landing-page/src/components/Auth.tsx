import { useEffect, type ReactNode } from 'react'
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  UserButton,
  useAuth,
  useClerk,
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
        /* This is still a Clerk development instance — the flag only hides the
           yellow "Development mode" badge, it does not make the instance a
           production one. A real production instance needs a custom domain. */
        layout: { unsafe_disableDevelopmentModeWarnings: true },
      }}
    >
      <AuthBridge>{children}</AuthBridge>
    </ClerkProvider>
  )
}

/* Sign-in opens as an overlay, never as its own page. Families reach it from
   the middle of something — reading a briefing, following a setup link — and
   navigating away from that loses their place. Clerk's modal keeps the page
   underneath, and closing it puts them back exactly where they were. */
const hide = { display: 'none' } as const

const MODAL_OPTS = () => ({
  appearance: {
    elements: {
      /* Google only. One tap, no password to forget, and the family's real
         name and photo come along for free — which is what the dashboard
         greets them with. The email field and its "or" divider are hidden
         here rather than globally, so the account-management screens behind
         the avatar menu keep their own forms. */
      dividerRow: hide,
      form: hide,
      /* The footer carries "Don't have an account? Sign up" and Clerk's
         "Secured by" badge. Both go: Google OAuth signs up a new family on
         first use, so a separate sign-up route has nothing left to do. */
      footer: hide,
    },
  },
  /* come back to this exact route (hash included) if the provider bounces
     through a redirect, so signing in from the dashboard returns there */
  fallbackRedirectUrl: window.location.href,
  signUpFallbackRedirectUrl: window.location.href,
})

/** Opens the Clerk sign-in overlay. Rendered only when Clerk is configured. */
function OpenSignIn({ className, children }: { className: string; children: ReactNode }) {
  const clerk = useClerk()
  return (
    <button type="button" onClick={() => clerk.openSignIn(MODAL_OPTS())} className={className}>
      {children}
    </button>
  )
}

/** Pops the overlay open by itself, once, on a page that needs an account. */
function AutoOpenSignIn() {
  const clerk = useClerk()
  useEffect(() => {
    clerk.openSignIn(MODAL_OPTS())
  }, [clerk])
  return null
}

/**
 * The signed-in family member's avatar + sign-out menu. Signed out, a sign-in
 * pill — `signInClass` lets a cramped bar (the mobile nav) hide the pill and
 * offer sign-in from its menu instead, while the avatar always stays visible.
 */
export function AccountButton({
  signInClass = 'pill pill-ghost !py-2 !text-[13px] whitespace-nowrap',
}: {
  signInClass?: string
}) {
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
        <OpenSignIn className={signInClass}>Sign in</OpenSignIn>
      </SignedOut>
    </>
  )
}

/** Sign-in as a row inside a mobile menu. Renders nothing once signed in. */
export function SignInMenuItem({ className }: { className: string }) {
  if (!clerkConfigured()) return null
  return (
    <SignedOut>
      <OpenSignIn className={className}>Sign in</OpenSignIn>
    </SignedOut>
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
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <OpenSignIn className="pill pill-primary !py-2.5 !text-[14px]">
              Sign in to continue
            </OpenSignIn>
            <a href="#/try" className="text-tx-secondary hover:text-tx text-[13px] underline">
              Just want to hear it talk?
            </a>
          </div>
          <AutoOpenSignIn />
        </div>
      </SignedOut>
    </>
  )
}
