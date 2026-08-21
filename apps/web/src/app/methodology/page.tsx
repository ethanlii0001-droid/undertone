import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Methodology — UnderTone",
};

const SECTIONS = [
  { id: "how-it-works", label: "How UnderTone works" },
  { id: "interpretability", label: "Interpretability" },
  { id: "what-it-does-not-do", label: "What it does NOT do" },
  { id: "evaluation", label: "Evaluation" },
] as const;

export default function MethodologyPage() {
  return (
    <div className="flex flex-col flex-1">
      <div className="mx-auto w-full max-w-[1180px] pt-8 pb-6 sm:pt-12 sm:pb-8">
        <h1 className="font-serif-display text-2xl sm:text-3xl tracking-tight">Methodology</h1>
        <p className="text-sm sm:text-base leading-relaxed mt-2 max-w-prose" style={{ color: "var(--ink-muted)" }}>
          What UnderTone measures, how it measures it, and where that measurement stops.
        </p>
      </div>

      <div className="mx-auto w-full max-w-[1180px] pb-10 lg:grid lg:grid-cols-[200px_1fr] lg:gap-16">
        <nav aria-label="Sections" className="hidden lg:block lg:sticky lg:top-8 lg:self-start">
          <ul className="flex flex-col gap-2.5 text-sm">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="transition-editorial block"
                  style={{ color: "var(--ink-muted)" }}
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="max-w-[760px]">
          <Section id="how-it-works" heading="How UnderTone works">
            <p>
              UnderTone identifies a reproducible workplace request in a message, then computes
              two independent scores for it on a 0–10 scale.
            </p>
            <SubHeading>Surface strength</SubHeading>
            <p>
              How strongly the request itself is phrased — its directness, modal wording, hedges,
              and optionality formulas like &ldquo;no rush&rdquo; or &ldquo;whenever you get a
              chance.&rdquo;
            </p>
            <SubHeading>Communicative force</SubHeading>
            <p>
              How strongly observable, non-surface evidence in the surrounding language makes
              action expected — deadlines, consequences, dependencies, accountability, and
              repetition.
            </p>
            <SubHeading>Pragmatic gap</SubHeading>
            <p>
              The difference between the two:{" "}
              <span className="font-numeric">force − surface</span>. A large positive gap means
              the surrounding context carries more pressure than the request&rsquo;s phrasing
              makes immediately visible. A large negative gap means the phrasing carries more
              force than the surrounding context independently supports.
            </p>
            <SubHeading>Confidence</SubHeading>
            <p>
              A separate reliability estimate for the analysis itself — how internally consistent
              and unambiguous the detected evidence is. It describes the rule-based analysis, not
              how certain the sender was or how likely the recipient is to comply.
            </p>
          </Section>

          <Section id="interpretability" heading="Interpretability">
            <p>
              Every score traces back to exact character spans in the original message. Surface
              and communicative force share only one early step: a first pass identifies the
              request itself. From there the two scores are computed independently. Surface
              strength is scored from the request&rsquo;s own visible wording. Before force
              scoring begins, every surface-visible span in the message is masked out — the force
              scorer never receives the surface score, the request strategy, the mood or modal
              wording, or any surface softening. It sees only the masked message and masked prior
              context, so its evidence can never be surface material in disguise.
            </p>
            <p>
              The engine is deterministic and rule-based — no language model, no network calls,
              nothing outside the function&rsquo;s own arguments. The same message and
              configuration always produce the same scores and the same evidence trace.
            </p>
          </Section>

          <Section id="what-it-does-not-do" heading="What UnderTone does NOT do">
            <ul className="list-disc pl-5 flex flex-col gap-1.5">
              <li>Infer a sender&rsquo;s intent — what they meant, wanted, knew, or believed.</li>
              <li>Predict how a recipient will actually behave.</li>
              <li>Detect deception, personality, or emotion.</li>
              <li>
                Claim calibrated accuracy against human perception. The 0–10 scales are an
                engineering convenience, not a validated psychometric instrument.
              </li>
            </ul>
          </Section>

          <Section id="evaluation" heading="Evaluation">
            <p>UnderTone&rsquo;s internal release suite currently reports:</p>
            <div className="flex flex-wrap gap-x-10 gap-y-4 py-1">
              <EvalStat value="12" label="Pass" />
              <EvalStat value="1" label="Partial" />
              <EvalStat value="1" label="Not measurable" />
              <EvalStat value="0" label="Fail" />
            </div>
            <p>
              These are specification tests measuring implementation fidelity and internal
              consistency — whether the code behaves the way the specification says it should —
              not external human validation. They confirm, for example, that softening a
              request&rsquo;s wording moves surface without moving force, and that adding an
              independent deadline moves force without changing the request&rsquo;s wording. They
              do not confirm that a human reader would assign the same numbers.
            </p>
            <p>
              The one PARTIAL result concerns CCSARP request-strategy detection: levels 1–7 of the
              nine-level directness scale are fully implemented and tested, while levels 8 and 9
              (conventionally indirect hints, which require reasoning about prior thread context)
              are not yet detected and are excluded from scoring rather than guessed at.
            </p>
          </Section>
        </article>
      </div>
    </div>
  );
}

function Section({ id, heading, children }: { id: string; heading: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-16 first:mt-0 scroll-mt-8">
      <h2 className="font-serif-display text-xl tracking-tight mb-3">{heading}</h2>
      <div
        className="flex flex-col gap-3 text-sm sm:text-base leading-relaxed"
        style={{ color: "var(--ink-muted)" }}
      >
        {children}
      </div>
    </section>
  );
}

function EvalStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-numeric text-2xl font-medium" style={{ color: "var(--ink)" }}>
        {value}
      </div>
      <div className="metric-label mt-0.5">{label}</div>
    </div>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="metric-label mt-1" style={{ color: "var(--ink)" }}>
      {children}
    </h3>
  );
}
