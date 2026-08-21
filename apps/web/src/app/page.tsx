import { Header } from "@/components/Header";

export default function LandingPage() {
  return (
    <div className="flex flex-col flex-1">
      <Header />

      <HowItWorks />
      <Interpretability />
      <LocalByDesign />
    </div>
  );
}

function HowItWorks() {
  return (
    <section aria-labelledby="how-it-works-heading" className="mx-auto w-full max-w-[1180px] mt-16 sm:mt-20">
      <h2 id="how-it-works-heading" className="font-serif-display text-lg mb-6 lg:mb-8">
        How it works
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
        <Stage number="01" title="Surface">
          <p>How strongly the request itself is phrased.</p>
          <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>
            Signals: directness, modal wording, hedges, optionality formulas.
          </p>
        </Stage>

        <Stage number="02" title="Communicative force">
          <p>Observable surrounding language that makes action expected.</p>
          <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>
            Signals: deadlines, consequences, dependencies, accountability, repetition.
          </p>
        </Stage>

        <Stage number="03" title="Pragmatic gap">
          <p>The difference between the two.</p>
          <p className="text-sm mt-1.5" style={{ color: "var(--ink-muted)" }}>
            A large positive gap means the surrounding context carries more pressure than the
            request&rsquo;s phrasing makes immediately visible.
          </p>
        </Stage>
      </div>
    </section>
  );
}

function Stage({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 lg:flex-col lg:gap-2 lg:border-t lg:pt-5" style={{ borderColor: "var(--hairline)" }}>
      <span
        className="font-numeric text-xs pt-0.5 shrink-0 lg:pt-0"
        style={{ color: "var(--ink-faint)" }}
        aria-hidden="true"
      >
        {number}
      </span>
      <div>
        <h3 className="font-serif-display text-base">{title}</h3>
        <div className="text-sm mt-1 max-w-prose" style={{ color: "var(--ink-muted)" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Static, hand-authored example of the evidence trace's visual language
 * (Prompt 10 §4). Deliberately never calls `score()` — this is illustration,
 * not a live analysis of the landing page's own copy.
 */
function Interpretability() {
  return (
    <section aria-labelledby="interpretability-heading" className="mx-auto w-full max-w-[1180px] mt-16 sm:mt-20">
      <div className="lg:grid lg:grid-cols-[400px_1fr] lg:gap-14 lg:items-center">
        <div>
          <h2 id="interpretability-heading" className="font-serif-display text-lg mb-2">
            Every score has a trace.
          </h2>
          <p className="text-sm leading-relaxed max-w-prose" style={{ color: "var(--ink-muted)" }}>
            UnderTone highlights the precise spans of text that contribute to each score — nothing
            is scored without a visible reason.
          </p>
        </div>

        <div
          className="border rounded-sm p-4 sm:p-5 mt-6 lg:mt-0"
          style={{ borderColor: "var(--hairline)", background: "var(--paper-raised)" }}
        >
          <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-[0.7rem]" style={{ color: "var(--ink-muted)" }}>
            <span className="inline-flex items-center gap-1.5">
              <span className="legend-swatch legend-swatch-surface" aria-hidden="true" />
              Surface evidence
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="legend-swatch legend-swatch-force" aria-hidden="true" />
              Force evidence
            </span>
          </div>

          <p className="leading-relaxed text-[0.95rem]" aria-hidden="true">
            <mark className="ev-surface">Whenever you get a chance</mark>, could you send over the
            deck? <mark className="ev-force">Legal is blocked on this</mark> until we get it, so
            ideally <mark className="ev-force">today</mark>.
          </p>
          <p className="sr-only">
            Illustrative example only — not a live analysis. &ldquo;Whenever you get a
            chance&rdquo; is marked as surface evidence. &ldquo;Legal is blocked on this&rdquo; and
            &ldquo;today&rdquo; are marked as force evidence.
          </p>
        </div>
      </div>
    </section>
  );
}

function LocalByDesign() {
  return (
    <section aria-labelledby="local-heading" className="mx-auto w-full max-w-[1180px] mt-16 sm:mt-20">
      <div className="lg:grid lg:grid-cols-2 lg:gap-14">
        <div>
          <h2 id="local-heading" className="font-serif-display text-lg mb-2">
            Local by design
          </h2>
          <p className="text-xs mt-3 max-w-prose" style={{ color: "var(--ink-faint)" }}>
            UnderTone is an engineering instrument for workplace English, not an intent detector
            or a calibrated model of human perception.
          </p>
        </div>
        <div
          className="text-sm leading-relaxed max-w-prose flex flex-col gap-2 mt-4 lg:mt-0"
          style={{ color: "var(--ink-muted)" }}
        >
          <p>Analysis runs entirely in your browser.</p>
          <p>Message text is never sent to an UnderTone backend.</p>
          <p>The diagnostic engine is deterministic and rule-based.</p>
        </div>
      </div>
    </section>
  );
}
