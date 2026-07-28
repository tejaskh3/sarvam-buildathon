import { Reveal } from '../components/Primitives'
import { LogoPlate } from '../components/Logo'

export function Footer() {
  return (
    <>
      {/* closing CTA */}
      <section className="bg-tx relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(90% 60% at 50% 110%, rgba(129,140,248,0.28) 0%, rgba(30,32,51,0) 70%)',
          }}
        />
        <div className="relative mx-auto w-full max-w-[1180px] px-5 py-24 text-center sm:px-8 sm:py-32">
          <Reveal>
            <p className="font-season mb-6 text-[40px] leading-none text-white/90 sm:text-[50px]">
              Yaadein
            </p>
            <h2 className="font-season mx-auto max-w-3xl text-[36px] leading-[1.08] tracking-[-0.015em] text-balance text-white sm:text-[52px]">
              Most of the day, there is nobody to talk to. That is the thing
              we’re fixing.
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-[16px] leading-relaxed text-white/55 text-pretty">
              Ten minutes a day, in their own language, with something that
              actually remembers what they said last time — and turns it into a
              reason for their family to call.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-2.5">
              <a
                href="#/try"
                className="pill bg-white text-tx hover:bg-sr-indigo-100"
              >
                Talk to Yaadein
              </a>
              {/* The last thing on the page asks for the seat. This used to be
                  "See how we remember", which sent someone who had just read
                  the whole page back up to the middle of it. */}
              {/* The footer also renders ON the waitlist page, where setting the
                  hash to the one it already has fires no hashchange and moves
                  nothing — the button would look dead. There, scroll to the
                  form instead. */}
              <a
                href="#/waitlist"
                onClick={() => {
                  if (window.location.hash === '#/waitlist')
                    document
                      .getElementById('seats')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }}
                className="pill border border-white/20 bg-transparent text-white hover:border-white/60"
              >
                <span className="bg-sr-green-600 live-dot h-1.5 w-1.5 rounded-full" />
                Claim a free seat
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* evidence base — reminiscence & cognitive stimulation research */}
      <section className="bg-tx border-t border-white/10">
        <div className="mx-auto w-full max-w-[1180px] px-5 py-10 sm:px-8">
          <p className="font-mono text-[10px] tracking-[0.16em] text-white/40 uppercase">
            The research behind Yaadein
          </p>
          <ol className="mt-4 max-w-3xl list-decimal space-y-2.5 pl-5 text-[12.5px] leading-relaxed text-white/45">
            <li>
              Woods B, Rai HK, Elliott E, Aguirre E, Orrell M, Spector A (2023).{' '}
              <span className="text-white/60">
                Cognitive stimulation to improve cognitive functioning in people with dementia.
              </span>{' '}
              Cochrane Database of Systematic Reviews, Issue 1, CD005562.
            </li>
            <li>
              Woods B, O&apos;Philbin L, Farrell EM, Spector AE, Orrell M (2018).{' '}
              <span className="text-white/60">Reminiscence therapy for dementia.</span>{' '}
              Cochrane Database of Systematic Reviews, 3, CD001120. PMID 29493789.
            </li>
            <li>
              <span className="text-white/60">
                Comparative efficacy of cognitive training modalities in cognitive impairment: a
                systematic review and network meta-analysis
              </span>{' '}
              (2025).
            </li>
          </ol>
          <p className="mt-4 max-w-3xl text-[11px] leading-relaxed text-white/30">
            Yaadein supports engagement and connection. It is not a medical device and does not
            diagnose, treat, or cure dementia.
          </p>
        </div>
      </section>

      <footer className="bg-tx border-t border-white/10">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-5 py-9 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-2.5">
            <LogoPlate size={24} tile={30} />
            <span className="font-mono text-[10.5px] tracking-[0.12em] text-white/45 uppercase">
              Yaadein
            </span>
          </div>

          {/* The full map lives here, including the two the top bar dropped
              when it was trimmed to six — a section reachable only by scrolling
              past it is a section nobody reaches. */}
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {[
              ['#personas', 'Who this is for'],
              ['#loop', 'How it works'],
              ['#experience', 'How to use'],
              ['#languages', '11 languages'],
              ['#app', 'The app'],
              ['#pricing', 'Pricing'],
              ['#about', 'About us'],
              ['#/waitlist', 'The first fifty'],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="text-[12.5px] text-white/45 transition-colors hover:text-white"
              >
                {label}
              </a>
            ))}
          </nav>

          <p className="font-mono text-[10.5px] tracking-[0.12em] whitespace-nowrap text-white/35 uppercase">
            Built on Sarvam · Sarvam Buildathon
          </p>
        </div>
      </footer>
    </>
  )
}
