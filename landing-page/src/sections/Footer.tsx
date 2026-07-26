import { Reveal } from '../components/ui'

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
              <a
                href="#loop"
                className="pill border border-white/20 bg-transparent text-white hover:border-white/60"
              >
                See how it remembers
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="bg-tx border-t border-white/10">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-5 py-9 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-white/10">
              <svg width="16" height="16" viewBox="0 0 32 32" fill="none" aria-hidden>
                <path
                  d="M9 11.5v4.2c0 2.2 1.5 3.6 3.6 3.6s3.6-1.4 3.6-3.6v-4.2M16.2 15.7c0 2.2 1.5 3.6 3.6 3.6s3.6-1.4 3.6-3.6v-4.2"
                  stroke="#fff"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <circle cx="16" cy="23.5" r="1.5" fill="#818cf8" />
              </svg>
            </span>
            <span className="font-mono text-[10.5px] tracking-[0.12em] text-white/45 uppercase">
              Yaadein
            </span>
          </div>

          <p className="font-mono text-[10.5px] tracking-[0.12em] text-white/35 uppercase">
            Built on Sarvam · Sarvam Buildathon
          </p>
        </div>
      </footer>
    </>
  )
}
