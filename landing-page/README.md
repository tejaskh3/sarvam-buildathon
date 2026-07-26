# यादें · Yaadein — landing page

A voice companion for elders living with memory loss. Tap the microphone and
talk, in any Indian language. It asks your name and where you live, and a few
days later opens with *“you mentioned you live in Pune — what do you like about
Pune?”*, quietly noting whether the answer came back.

The page sells the experience, not the system. `#/try` routes to the live demo.

React + TypeScript + Vite + Tailwind CSS v4.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # → dist/
npm run preview
```

No language is named anywhere in the copy — it is meant to be plug-and-play
across Indian languages, so the page says "any Indian language" rather than
listing them.

## Design system

Ported from [sarvam.ai](https://www.sarvam.ai) and defined as Tailwind theme
tokens in `src/index.css`, using Sarvam's own naming:

| Token          | Value                 | Role                          |
| -------------- | --------------------- | ----------------------------- |
| `tx`           | `#1e2033`             | primary ink                   |
| `tx-secondary` | `#3a3f5c`             | body                          |
| `tx-tertiary`  | `#6b7092`             | supporting                    |
| `sf`           | `#f5f5f3`             | page surface (warm off-white) |
| `sf-secondary` | `#f0f1f5`             | inset surface                 |
| `st-secondary` | `#dedee0`             | hairline borders              |
| `sr-indigo-*`  | `#d5e2ff` → `#6366f1` | accent ramp                   |
| `sr-green-*`   | `#e3f1d8` → `#496d21` | pass / positive               |
| `sr-warm-*`    | `#f6efe6` → `#3d2b1a` | Savita's voice, memory        |
| `sr-purple-*`  | `#f1f0ff` → `#6d5cf0` | the person's voice (listening) |
| `sr-pink-*`    | `#fdeef5` → `#d94a8c` | Yaadein's voice (speaking)     |
| `sr-rose-*`    | `#f7e2dd` / `#c43d2b` | flagged                        |

Typefaces substitute free equivalents for Sarvam's licensed originals:

- `font-season` → **Instrument Serif** (for Sarvam's Season Mix display serif)
- `font-matter` → **Switzer** (for Matter, the UI grotesk)
- `font-mono` → **JetBrains Mono** (for Matter Mono eyebrows and labels)
If you have licences for Matter and Season Mix, self-host the woff2 files and
swap the two `--font-*` values in `src/index.css` — nothing else changes.

## Structure

```
src/
  data.ts                 personas, the four-step loop, the six principles,
                          and what each family member receives
  components/
    Orb.tsx               the particle orb, shared with the live demo
    ui.tsx                Reveal, Section, SectionHead, tone map
  sections/
    Nav.tsx               ticker + sticky nav
    Hero.tsx              hero + the session demo
    SessionDemo.tsx       three visits: name → Pune → did it come back?
    Personas.tsx          Kamala, Meena, Arjun, Latha
    Contract.tsx          <Loop/> — ask, remember, come back, notice
    Flow.tsx              <Experience/> — what it's like to use
    Coverage.tsx          what the family and the coordinator get
    Footer.tsx            closing CTA + footer
  try/
    TryPage.tsx           the real thing: mic → agent server → spoken reply
```

All page copy lives in `data.ts`. Edit it there and every surface updates.

## Notes

- The hero demo starts only once scrolled into view, and cycles through the
  three visits. Clicking a visit chip stops the cycling and holds that one.
- One orb, two voices: **purple while the person talks** (Listening),
  **pink while Yaadein talks** (Speaking), grey and still at rest. The colour
  eases between states rather than snapping. Pink is mixed a shade deeper than
  purple so the two carry equal weight on the off-white page.
- The label under the orb is the only status text — there is no Idle/Thinking
  state shown to the user.
- On the live demo the microphone is the only control, and **the space bar does
  exactly the same thing** (start talking / stop and send). Space never scrolls
  the page, and is ignored while typing in a field.
- `Orb.tsx` takes a real `levelRef` on the live demo so the sphere moves with
  actual audio, and falls back to a synthetic pulse on the landing page. It
  stops animating under `prefers-reduced-motion`.
- The live demo needs the agent server running (`node app/server.js`) and
  `VITE_API_BASE` pointed at it.
