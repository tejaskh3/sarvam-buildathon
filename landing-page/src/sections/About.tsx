import { Section, SectionHead } from '../components/ui'

/* About us — copy is a placeholder; Tejas will supply the real text. */

export function About() {
  return (
    <Section id="about" tone="white">
      <SectionHead
        eyebrow="about us"
        title="A small team that kept calling home."
        lede="Yaadein is built by a small team at the Sarvam AI Buildathon — engineers and designers who have watched someone they love repeat a question, and watched the family slowly run out of things to ask back. We are building the companion we wish our own grandparents had: patient, in their own language, and honest with the family about how things are really going."
      />
    </Section>
  )
}
