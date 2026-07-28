import { useEffect, useId, useRef, useState } from 'react'

/* ------------------------------------------------------------------
   Language picker.

   A native <select> was the obvious choice and it looked wrong: macOS
   and Windows draw the open list themselves — dark, system-styled,
   nothing to do with the page — and no amount of CSS reaches inside it.
   The only way to control the open state is to draw it.

   So this is a real listbox: button + popup, keyboard-driven, closes on
   Escape or an outside click. It also shows both names for a language,
   which the native control had no room for.
   ------------------------------------------------------------------ */

/* [code, how the language names itself, how it's named in English].
   Both are shown wherever there's room: the adult child filling the form may
   not read Devanagari or Odia, but knows their mother speaks Hindi. */
export const LANGS: [code: string, native: string, english: string][] = [
  ['hi-IN', 'हिन्दी', 'Hindi'],
  ['kn-IN', 'ಕನ್ನಡ', 'Kannada'],
  ['ta-IN', 'தமிழ்', 'Tamil'],
  ['te-IN', 'తెలుగు', 'Telugu'],
  ['mr-IN', 'मराठी', 'Marathi'],
  ['bn-IN', 'বাংলা', 'Bengali'],
  ['gu-IN', 'ગુજરાતી', 'Gujarati'],
  ['ml-IN', 'മലയാളം', 'Malayalam'],
  ['pa-IN', 'ਪੰਜਾਬੀ', 'Punjabi'],
  ['od-IN', 'ଓଡ଼ିଆ', 'Odia'],
  ['en-IN', 'English', 'English'],
]

export function LangSelect({
  value,
  onChange,
  className = '',
}: {
  value: string
  onChange: (code: string) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(() => Math.max(0, LANGS.findIndex(([c]) => c === value)))
  const wrap = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const id = useId()

  const selected = LANGS.find(([c]) => c === value) ?? LANGS[0]

  /* Outside click and Escape. mousedown rather than click, so pressing down on
     the page closes the list instead of waiting for the button release. */
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  /* Opening lands on the current choice, and every arrow keeps the highlighted
     row on screen — the list is taller than its scroll box. */
  useEffect(() => {
    if (!open) return
    setActive(Math.max(0, LANGS.findIndex(([c]) => c === value)))
    list.current?.focus()
  }, [open, value])

  useEffect(() => {
    if (!open) return
    list.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const choose = (i: number) => {
    onChange(LANGS[i][0])
    setOpen(false)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : LANGS.length - 1)) % LANGS.length)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      choose(active)
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      setActive(e.key === 'Home' ? 0 : LANGS.length - 1)
    }
  }

  return (
    <div ref={wrap} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-value`}
        className={`border-st-secondary text-tx flex w-full items-center justify-between gap-2 rounded-xl border bg-white px-4 py-3 text-left text-[15px] outline-none transition-colors ${
          open ? 'border-tx' : 'hover:border-tx-tertiary'
        }`}
      >
        <span className="min-w-0 truncate">
          <span id={`${id}-label`} className="text-tx-tertiary">
            Language ·{' '}
          </span>
          <span id={`${id}-value`}>{selected[1]}</span>
          {selected[1] !== selected[2] && (
            <span className="text-tx-tertiary"> ({selected[2]})</span>
          )}
        </span>
        <Chevron open={open} />
      </button>

      {open && (
        <div
          ref={list}
          role="listbox"
          tabIndex={-1}
          aria-label="Language"
          onKeyDown={onKey}
          className="border-st-secondary absolute top-full right-0 left-0 z-30 mt-2 max-h-[16rem] overflow-y-auto rounded-xl border bg-white py-1.5 shadow-[0_16px_40px_-12px_rgba(30,32,51,0.28)] outline-none"
        >
          {LANGS.map(([code, native, english], i) => {
            const isSelected = code === value
            return (
              <div
                key={code}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(i)}
                className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-[15px] ${
                  i === active ? 'bg-sf-secondary' : ''
                } ${isSelected ? 'text-tx font-medium' : 'text-tx-secondary'}`}
              >
                <span>
                  {native}
                  {native !== english && (
                    <span className="text-tx-tertiary text-[13px]"> · {english}</span>
                  )}
                </span>
                {isSelected && <Tick />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
      className={`text-tx-tertiary shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
    >
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Tick() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden className="text-sr-indigo-700 shrink-0">
      <path
        d="m2.5 7.5 3 3 6-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
