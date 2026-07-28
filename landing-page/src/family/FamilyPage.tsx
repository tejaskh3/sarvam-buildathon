import { useEffect, useState } from 'react'
import { PhoneGate, clearStoredPhone, getStoredPhone } from '../components/PhoneGate'
import { AccountButton, RequireFamilySignIn } from '../components/Auth'
import { authFetch, clerkConfigured } from '../lib/auth'
import { Logo } from '../components/Logo'
import { API } from '../lib/api'
import type { Person } from './types'
import { HandoffCard } from './cards/HandoffCard'
import { OverviewPanel } from './OverviewPanel'
import { BriefingTab } from './tabs/BriefingTab'
import { SignalsTab } from './tabs/SignalsTab'
import { ScribeTab } from './tabs/ScribeTab'
import { MemoirTab } from './tabs/MemoirTab'
import { MemoriesTab } from './tabs/MemoriesTab'
import { PhotosTab } from './tabs/PhotosTab'

/* ------------------------------------------------------------------
   Family Dashboard — the caregiver's side of Yaadein.
   At-a-glance insights · visit briefing · alerts & trends · the living
   memoir · every memory with provenance · photo uploads that become
   tomorrow's conversation.
   The elder never sees this page; their only surface is the orb.

   This file is the shell only: identity, the person picker, and which
   tab is showing. Each panel lives in its own module.
   ------------------------------------------------------------------ */

export function FamilyPage() {
  const [people, setPeople] = useState<Person[]>([])
  const [pid, setPid] = useState<number | null>(null)
  const [tab, setTab] = useState<'briefing' | 'signals' | 'scribe' | 'memoir' | 'memories' | 'photos'>('briefing')
  /* Two identities, on purpose: Clerk says WHO the family member is, the phone
     number says WHICH elder. So a signed-in family never retypes the number —
     we ask the server which households their account owns. */
  const [phone, setPhone] = useState<string | null>(getStoredPhone)
  const [gateOpen, setGateOpen] = useState(true)
  const [linking, setLinking] = useState(clerkConfigured())

  useEffect(() => {
    if (!clerkConfigured()) { setLinking(false); return }
    let live = true
    authFetch(`${API}/api/households`)
      .then((r) => (r.ok ? r.json() : { households: [] }))
      .then((j: { households?: { phone: string }[] }) => {
        if (!live) return
        const first = j.households?.[0]
        if (first) {
          localStorage.setItem('yaadein-phone', first.phone)
          setPhone(first.phone)
        }
      })
      .catch(() => {/* not signed in yet — the sign-in wall handles it */})
      .finally(() => live && setLinking(false))
    return () => { live = false }
  }, [])

  useEffect(() => {
    if (!phone) return
    authFetch(`${API}/api/people?phone=${phone}`)
      .then((r) => {
        if (r.status === 403) {
          clearStoredPhone()
          setPhone(null)
          return []
        }
        return r.json()
      })
      .then((ps: Person[]) => {
        setPeople(ps)
        setPid(ps.length ? ps[0].id : null)
      })
      .catch(() => setPeople([]))
  }, [phone])

  return (
    <div className="bg-sf min-h-screen">
      {!linking && (
        <SignedInOnlyGate phone={phone} gateOpen={gateOpen} setPhone={setPhone} setGateOpen={setGateOpen} />
      )}
      <header className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-5 py-4 sm:px-8">
        <a href="#top" onClick={() => (window.location.hash = '')} className="flex items-center gap-2">
          <Logo size={30} />
          <span className="font-deva text-tx text-[19px] leading-none">यादें</span>
          <span className="text-tx-tertiary text-[13px] font-medium">Yaadein · Family</span>
        </a>
        <div className="flex gap-2">
          <a href="#/try" className="pill pill-ghost !py-2 !text-[13px]">Talk to Yaadein</a>
          <AccountButton />
          <a href="#top" onClick={() => (window.location.hash = '')} className="pill pill-ghost !py-2 !text-[13px]">← Site</a>
        </div>
      </header>

      <RequireFamilySignIn>
      <main className="mx-auto w-full max-w-[880px] px-5 pb-20 sm:px-8">
        <h1 className="font-season text-tx mt-4 text-[32px] tracking-tight">Before you visit</h1>
        <p className="text-tx-secondary mt-1 text-[15px]">
          Built from their own words — nothing invented. They never see this page.
        </p>

        {/* person picker */}
        <div className="mt-6 flex flex-wrap gap-2">
          {people.map((p) => (
            <button
              key={p.id}
              onClick={() => setPid(p.id)}
              className={`rounded-full border px-4 py-1.5 text-[14px] transition-colors ${
                pid === p.id
                  ? 'border-tx bg-tx text-white'
                  : 'border-st-secondary text-tx-secondary bg-white hover:border-tx'
              }`}
            >
              {p.name}
              <span className="ml-1.5 opacity-60">{p.memory_count}</span>
            </button>
          ))}
          {!people.length && phone && <span className="hidden" />}
          {!phone && !linking && (
            <button onClick={() => setGateOpen(true)} className="pill pill-primary !py-2 !text-[13px]">
              Link your parent&apos;s number
            </button>
          )}
        </div>

        {/* Nothing to show until the elder has actually talked. Rather than an
            empty page, hand the family the one thing they need next: the link
            that sets up their parent's phone. */}
        {!people.length && phone && !linking && <HandoffCard phone={phone} />}

        {/* at a glance: numbers, moods, topics — before any tab is opened */}
        {pid !== null && <OverviewPanel pid={pid} />}

        {/* tabs */}
        {pid !== null && (
          <>
            <div className="border-st-secondary mt-8 flex flex-wrap gap-x-5 gap-y-1 border-b">
              {(
                [
                  ['briefing', 'Visit briefing'],
                  ['signals', 'Alerts & trends'],
                  ['scribe', 'Session notes'],
                  ['memoir', 'Living memoir'],
                  ['memories', 'Every memory'],
                  ['photos', 'Photos'],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`-mb-px border-b-2 pb-2.5 text-[14px] font-medium transition-colors ${
                    tab === k ? 'border-tx text-tx' : 'text-tx-tertiary border-transparent hover:text-tx'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-6">
              {tab === 'briefing' && (
                <BriefingTab
                  pid={pid}
                  /* fallback reads correctly in a sentence — "They hasn't
                     talked…" would not */
                  name={people.find((p) => p.id === pid)?.name || 'Your parent'}
                />
              )}
              {tab === 'signals' && <SignalsTab pid={pid} />}
              {tab === 'scribe' && <ScribeTab pid={pid} phone={phone} />}
              {tab === 'memoir' && <MemoirTab pid={pid} />}
              {tab === 'memories' && <MemoriesTab pid={pid} />}
              {tab === 'photos' && <PhotosTab pid={pid} />}
            </div>
          </>
        )}
      </main>
      </RequireFamilySignIn>
    </div>
  )
}

/* The number prompt belongs after sign-in — asking for a phone number on top
   of a sign-in card is two walls at once. */
export function SignedInOnlyGate({
  phone, gateOpen, setPhone, setGateOpen,
}: {
  phone: string | null; gateOpen: boolean
  setPhone: (p: string | null) => void; setGateOpen: (b: boolean) => void
}) {
  if (phone || !gateOpen) return null
  return (
    <RequireFamilySignIn>
      <PhoneGate api={API} onDone={setPhone} onClose={() => setGateOpen(false)} />
    </RequireFamilySignIn>
  )
}
