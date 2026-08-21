# UnderTone

UnderTone is a fully client-side, rule-based tool that analyzes workplace messages (Slack, Teams,
work email) and computes two independent scores for each identified request — how strongly it is
phrased, and how strongly the observable context around it makes action expected — then reports
the gap between them alongside the exact linguistic evidence behind each score.

## What it measures

- **Surface strength** — how forcefully a request is phrased: its directness, modal wording,
  hedges, and optionality formulas (e.g. "no rush", "whenever you get a chance").
- **Communicative force** — how strongly observable, non-surface evidence makes action expected:
  deadlines, consequences, dependencies, accountability, and repetition/escalation across a
  thread.
- **Pragmatic gap** — `force − surface`. A large positive gap means the surrounding context
  carries more pressure than the phrasing makes visible; a large negative gap means the phrasing
  carries more force than the surrounding context independently supports.
- **Confidence** — a separate reliability estimate for the analysis itself: how internally
  consistent and unambiguous the detected evidence is. It describes the rule-based analysis, not
  how certain the sender was or how likely the recipient is to comply.

Every score is accompanied by traceable evidence: specific character spans in the source message,
each with a category, subcategory, and weight. A score that can't be traced to evidence is never
emitted — the analysis reports a suppressed/null state instead.

## Why the architecture matters

Surface and communicative force are scored independently, but they are not computed from
disjoint input — they share one early step. A single request-identification pass first finds the
request (the head act) in a message. From there:

- Surface strength is scored from the request's own visible wording — its directness, modal
  verb, hedges, and intensifiers.
- Before force scoring begins, every surface-visible span is masked out of the message. The force
  scorer receives only this `MaskedMessage` — masked text, masked spans, the structural
  request-clause span with no strategy/mood label, a lemmatized request signature, timestamp,
  sender, and recipients — plus masked prior context from the thread. It never sees the raw
  message, the head act object, the surface strategy, the surface score, the modal verb, the
  grammatical mood, or any surface-mitigation span.

No character offset contributes to both surface and force evidence in the same message, and a
force rule must match the independent evidence span itself (e.g. `today`, `Legal is blocked on
this`) — never surface wording bundled around it. This is what makes the pragmatic gap meaningful
rather than circular.

The diagnostic engine (`packages/engine`) is pure, deterministic TypeScript with zero runtime
dependencies. There is no language model anywhere in the analysis path — no API calls, no
network, no backend. It runs entirely client-side in the browser, and it never reads the wall
clock, randomness, or environment; all time reasoning comes only from timestamps supplied in the
input.

## Website

- `/` — landing page
- `/analyze` — build or load a sample thread and analyze it
- `/compose` — live analysis of a message as you draft it
- `/methodology` — what UnderTone measures, how, and where that measurement stops

## Run locally

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

```bash
npm run build   # production build (apps/web)
npm run lint    # eslint (apps/web)
```

## Tests

```bash
npm test        # run the engine's spec-test suite once
npm run test:watch
npm run test:ui
```

The suite includes a release report (`eval/report.ts`, run via
`packages/engine/test/eval-report.test.ts`) that checks the 14 release assertions from
`SPEC.md` §15.3. Current status:

```
12 PASS
1 PARTIAL
1 NOT MEASURABLE
0 FAIL
```

- **PARTIAL** — CCSARP request-strategy detection. Levels 1–7 of the nine-level directness scale
  are fully implemented and strictly tested (`surface(L1) > … > surface(L7)` holds for all seven).
  Levels 8 and 9 (conventionally indirect hints, which require reasoning about prior thread
  context) remain explicit TODOs and are excluded from scoring rather than guessed at.
- **NOT MEASURABLE** — head-act detection precision/recall against labeled ground truth. The
  canonical fixtures (`EVAL.md`'s minimal pairs) annotate expected direction/invariance between
  paired message variants, not per-example positive/negative classification labels, so
  precision/recall has no legitimate denominator against the current fixture set.

These are internal specification tests: they measure implementation fidelity and internal
consistency — whether the code behaves the way the specification says it should — not external
human validation. They do not confirm that a human reader would assign the same numbers to a
given message.

## Privacy

Analysis runs locally in the browser. No UnderTone backend receives message text — there is no
UnderTone backend at all in the diagnostic path.

## Limitations

- Tuned for workplace English only.
- Does not infer a sender's intent — what they meant, wanted, knew, or believed.
- Does not predict how a recipient will actually behave.
- Has no model of organizational hierarchy or power dynamics.
- Does not interpret sarcasm or irony.
- Its 0–10 scales are an engineering convenience, not a psychometrically calibrated instrument.
- Request detection has known open gaps (CCSARP levels 8–9, some suppression guards) — see
  `CLAUDE.md`'s "Known gaps" section for specifics.
