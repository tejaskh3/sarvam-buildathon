# यादें · Yaadein — landing page

Landing page for the Sarvam Buildathon entry: a voice companion that learns an
elder's life story in her own language, and turns it into a memoir chapter, a
pre-visit briefing, and a coordinator digest.

React + TypeScript + Vite + Tailwind CSS v4.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # → dist/
npm run preview
```

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
| `sr-rose-*`    | `#f7e2dd` / `#c43d2b` | disputed / flagged            |

Typefaces substitute free equivalents for Sarvam's licensed originals:

- `font-season` → **Instrument Serif** (for Sarvam's Season Mix display serif)
- `font-matter` → **Switzer** (for Matter, the UI grotesk)
- `font-mono` → **JetBrains Mono** (for Matter Mono eyebrows and labels)
- `font-deva` → **Tiro Devanagari Hindi**, for यादें and all Marathi/Hindi copy

If you have licences for Matter and Season Mix, self-host the woff2 files and
swap the two `--font-*` values in `src/index.css` — nothing else changes.

## Structure

```
src/
  data.ts                 all 37 stories, 6 epics, 4 personas, contract, rubric
  components/ui.tsx       Reveal, Section, SectionHead, badges, tone maps
  sections/
    Nav.tsx               ticker + sticky nav
    Hero.tsx              hero + stat strip
    SessionDemo.tsx       animated 10-minute session, contract passing live
    Personas.tsx          Savita, Meena, Arjun, Latha
    Contract.tsx          the six conditions
    Flow.tsx              BEFORE / DURING / AFTER + the Sarvam stack
    Integrity.tsx         provenance grades, variance handling, safety floor
    Stories.tsx           filterable P0/P1/P2 story explorer
    Coverage.tsx          6 → 34 residents, and what each person receives
    Done.tsx              rubric table, ship gate, the three decisive stories
    Footer.tsx            closing CTA + footer
```

`data.ts` is the single source of truth — the story explorer, the ship-gate
chips, the contract badges and the filter counts are all derived from it. Edit
a story there and every surface updates.

## Notes

- The session player in the hero starts only when scrolled into view, and
  respects `prefers-reduced-motion`.
- All animation is CSS; no animation library.
