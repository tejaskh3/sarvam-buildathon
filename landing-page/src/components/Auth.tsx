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
import { Logo } from './Logo'

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

/* Clerk's default card is a generic SaaS login: system sans, tight radius,
   flat white. Dropped into a page set in Instrument Serif on warm grey it
   looks like a different product borrowed the tab. These pull it onto our
   tokens — the same variables the rest of the site is built from, so the
   card can't drift when we change the theme. */
const CLERK_LOOK = {
  variables: {
    colorPrimary: '#1e2033', // --color-tx: our buttons are ink, not indigo
    colorText: '#1e2033',
    colorTextSecondary: '#6b7092', // --color-tx-tertiary
    colorBackground: '#ffffff',
    colorInputBackground: '#ffffff',
    colorInputText: '#1e2033',
    colorNeutral: '#1e2033',
    fontFamily: 'var(--font-matter)',
    fontFamilyButtons: 'var(--font-matter)',
    fontSize: '15px',
    borderRadius: '14px',
    spacingUnit: '1rem',
  },
  elements: {
    // the card echoes .card — 24px, hairline stroke, soft lift
    card: {
      borderRadius: '24px',
      border: '1px solid #dedee0',
      boxShadow: '0 24px 60px -20px rgba(30, 32, 51, 0.28)',
      padding: '2.25rem 2rem 2rem',
    },
    cardBox: { borderRadius: '24px', boxShadow: 'none' },
    // headings are serif everywhere else on this site
    headerTitle: {
      fontFamily: 'var(--font-season)',
      fontSize: '25px',
      fontWeight: '400',
      letterSpacing: '-0.01em',
      color: '#1e2033',
    },
    headerSubtitle: { fontSize: '14px', lineHeight: '1.55', color: '#6b7092' },
    // a pill, like every other button we ship
    socialButtonsBlockButton: {
      borderRadius: '9999px',
      border: '1px solid #dedee0',
      padding: '0.75rem 1.25rem',
      fontSize: '14.5px',
      fontWeight: '500',
      color: '#1e2033',
      transition: 'border-color .18s ease, background-color .18s ease',
      '&:hover': { borderColor: '#1e2033', backgroundColor: '#f5f5f3' },
    },
    socialButtonsBlockButtonText: { fontSize: '14.5px', fontWeight: '500' },
    /* Clerk tags whichever provider you used last with a "Last used" pill. It's
       there to help you choose between several; Google is the only way in, so it
       labels a decision nobody is making. Hidden here rather than in MODAL_OPTS
       so it stays gone on every sign-in surface.

       The key is a real element descriptor — it appears in Clerk's own
       descriptor registry in clerk.browser 5.127.1, next to the socialButtons*
       entries. Don't lean on the compiler to catch a typo here: `elements` is
       typed as an open record, so a misspelled key type-checks and silently
       does nothing. */
    lastAuthenticationStrategyBadge: { display: 'none' },
    modalCloseButton: { color: '#6b7092', boxShadow: 'none' },
    // dim and blur behind, matching the phone-number dialog
    modalBackdrop: { backgroundColor: 'rgba(30, 32, 51, 0.45)', backdropFilter: 'blur(4px)' },
  },
  /* This is still a Clerk development instance — the flag only hides the
     yellow "Development mode" badge, it does not make the instance a
     production one. A real production instance needs a custom domain. */
  layout: { unsafe_disableDevelopmentModeWarnings: true },
} as const

/* Clerk's stock copy ("Welcome back! Please sign in to continue") is written
   for software. This page is about someone's mother. */
const CLERK_WORDS = {
  signIn: {
    start: {
      title: 'Your family’s memories',
      subtitle: 'Sign in to see what they’ve been telling Yaadein.',
    },
  },
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (!clerkConfigured()) return <>{children}</>
  return (
    <ClerkProvider
      publishableKey={CLERK_KEY}
      afterSignOutUrl="/"
      appearance={CLERK_LOOK}
      localization={CLERK_WORDS}
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
    ...CLERK_LOOK,
    elements: {
      ...CLERK_LOOK.elements,
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
export function OpenSignIn({ className, children }: { className: string; children: ReactNode }) {
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
  /** `null` renders nothing when signed out — for bars where another control
      (the nav's "For families") already leads to sign-in. */
  signInClass?: string | null
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
      {signInClass !== null && (
        <SignedOut>
          <OpenSignIn className={signInClass}>Sign in</OpenSignIn>
        </SignedOut>
      )}
    </>
  )
}

/**
 * The nav's way into the family dashboard.
 *
 * Signed out it opens the sign-in overlay rather than navigating. `#/family`
 * used to be a plain link, so a visitor who clicked it out of curiosity landed
 * on a page that immediately fired two authenticated requests, collected two
 * 401s in the console, and showed them a sign-in wall — a broken-looking round
 * trip to reach a dialog we can open in place. Same destination, no dead end.
 */
export function FamilyLink({ className }: { className: string }) {
  const link = (
    <a href="#/family" className={className}>
      For families
    </a>
  )
  if (!clerkConfigured()) return link
  return (
    <>
      <SignedIn>{link}</SignedIn>
      <SignedOut>
        <OpenSignIn className={className}>Sign in</OpenSignIn>
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
        {/* Centred and bounded. Left-aligned text at the top of an otherwise
            empty viewport read as a page that had failed to load — especially
            once the modal was dismissed and nothing was left but a stub. */}
        <div className="flex min-h-[78vh] items-center justify-center px-5 py-16">
          <div className="w-full max-w-[520px] text-center">
            <div className="flex justify-center">
              <Logo size={52} />
            </div>
            <h1 className="font-season text-tx mt-6 text-[32px] leading-[1.15] tracking-tight">
              Your family&apos;s memories,
              <br />
              kept for whoever asks next
            </h1>
            <p className="text-tx-secondary mx-auto mt-4 max-w-[430px] text-[15px] leading-relaxed">
              This page holds one person&apos;s life story — the things they told Yaadein, in their own words.
              It stays private to the family who set it up.
            </p>
            <div className="mt-7 flex flex-col items-center gap-3">
              <OpenSignIn className="pill pill-primary !py-2.5 !text-[14.5px]">
                Continue with Google
              </OpenSignIn>
              <a href="#/try" className="text-tx-tertiary hover:text-tx text-[13px] transition-colors">
                Just want to hear it talk?
              </a>
            </div>
            <p className="text-tx-tertiary border-st-secondary mx-auto mt-9 max-w-[400px] border-t pt-5 text-[12.5px] leading-relaxed">
              Your parent never signs in, and never has to remember anything. They just talk.
            </p>
          </div>
          <AutoOpenSignIn />
        </div>
      </SignedOut>
    </>
  )
}
