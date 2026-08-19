# UnderTone — Specification

**Version:** 1.1 (reconciled hackathon scope)  
**Status:** Normative. Where this document says MUST, MUST NOT, or SHALL, deviation is a defect.

---

## 1. Product statement

UnderTone measures the gap between how forcefully a workplace message phrases a request and how strongly observable, non-surface language makes action expected.

English often softens requests with questions, hedges, apologies, and optionality formulas. UnderTone operationalizes two quantities:

- **Surface strength** — how forcefully the identified request is phrased.
- **Communicative force** — how strongly observable evidence such as deadlines, consequences, dependencies, accountability, and repeated requests makes action expected.

The **Pragmatic Gap = communicative force − surface strength**.

A positive gap means the request is softer in wording than the independent pressure evidence around it. A negative gap means the wording is stronger than that evidence. The 0–10 values are **engineering scales internal to UnderTone**, not validated psychometric units. A gap of `+4` means four UnderTone units, not four empirically calibrated units of human perception.

UnderTone never claims to know a sender's private intent, motive, sincerity, or personality.

---

## 2. Canonical ownership and source of truth

The project uses three Phase 0 documents with deliberately separate ownership:

| Document | Owns |
|---|---|
| `SPEC.md` | architecture, invariants, formulas, suppression rules, confidence, test requirements |
| `LEXICON.md` | every lexical pattern, raw weight, normalization constant, pattern classification |
| `EVAL.md` | specification-test fixtures, expected directions/invariances, negative controls, hard cases |

If a lexical weight or pattern assignment appears to disagree with `LEXICON.md`, **LEXICON wins**. If an architectural rule disagrees with `SPEC.md`, **SPEC wins**. `EVAL.md` may not redefine either; it tests them.

Any numeric summaries copied from `LEXICON.md` into another document MUST be clearly labeled **generated/non-normative**.

---

## 3. Deployment shape and engine constraints

| Property | Value |
|---|---|
| Engine | Pure TypeScript function library, `packages/engine` |
| UI | Next.js app, `apps/web`, importing the engine directly |
| Runtime | 100% client-side; no backend or server processing of message text |
| Deployment | Vercel, static/client-rendered |
| Method | Deterministic rules and lexicons only |
| Network | No network calls from the diagnostic engine |
| Input unit | A whole thread; each message scored individually with prior messages available as context |
| Domain | Workplace English only |

The engine MUST be a pure function:

```ts
score(thread: Thread, config?: Config): ThreadAnalysis
```

The diagnostic engine MUST NOT call `fetch`, `XMLHttpRequest`, `Date.now()`, `Math.random()`, `navigator`, `localStorage`, or `process.env`. Time reasoning derives only from timestamps supplied in the input. Locale-sensitive date interpretation MUST use an explicit config value, never an implicit runtime locale.

Determinism is part of the experimental design: the same input and config must yield the same output and the same evidence trace.

---

## 4. Data model

```ts
type MessageId = string;

interface Message {
  id: MessageId;
  threadId: string;
  senderId: string;
  recipientIds: string[];
  mentionedIds: string[];
  timestamp: string; // ISO 8601 with offset
  text: string;
}

interface Thread {
  id: string;
  messages: Message[]; // ascending timestamp
}

interface Span {
  start: number; // half-open UTF-16 offsets
  end: number;
}

type Scorer = "surface" | "force";

interface Evidence {
  id: string;
  scorer: Scorer;
  category: string;
  subcategory: string;
  trigger: string;
  span: Span;
  messageId: MessageId;
  rawWeight: number;
  weight: number;
  capped: boolean;
  eventId: string;        // groups multiple matches that describe the same pragmatic event
  note: string;
  citation: string;
}

interface Confidence {
  value: number; // 0..1
  reasons: string[];
  ambiguityFlags: string[];
}

interface MessageAnalysis {
  messageId: MessageId;
  headAct: HeadAct | null;
  surface: number | null;
  force: number | null;
  gap: number | null;
  band: GapBand | null;
  confidence: Confidence | null;
  surfaceEvidence: Evidence[];
  forceEvidence: Evidence[];
  suppressed?: SuppressionReason;
}
```

`surface`, `force`, `gap`, `band`, and `confidence` are `null` whenever no reproducible request can be identified or a suppression rule fires.

---

## 5. Pipeline and the exact independence claim

The pipeline has **shared preprocessing** followed by two restricted scoring paths.

1. Normalize while preserving original offsets.
2. Segment into sentences and clauses.
3. Identify whether a request exists and locate its head act.
4. Record surface-visible spans: CCSARP strategy, modal/mood markers, and surface modifiers.
5. Score surface.
6. Build an offset-preserving `MaskedMessage`.
7. Score force from the masked message plus masked prior thread context.
8. Deduplicate force evidence into independent pragmatic events.
9. Compute gap.
10. Compute confidence.

### 5.1 The independence claim

The v1.1 claim is deliberately conditional:

> **Conditional on a request having been identified, communicative force is invariant to changes in the head act's modal verb, grammatical mood, CCSARP strategy realization, and head-act-internal mitigation, except insofar as those changes alter request detection itself.**

Request identification is shared preprocessing and therefore is **not** claimed to be independent of surface form.

Once a request has been identified, the force scorer MUST NOT receive the raw `Message`, `HeadAct`, surface strategy, surface score, modal verb, grammatical mood marker, or surface-mitigation spans.

This is the falsifiable core of the architecture.

---

## 6. Request/head-act identification

The **head act** is the clause that realizes the request.

The detector matches clauses against the CCSARP strategy inventory in `LEXICON.md` and uses the most direct matching strategy; ties go to the earliest span. This is a deterministic engineering choice, not a full syntactic/semantic parser.

### 6.1 Request-detection guards

The detector MUST suppress rather than guess when any of the following applies:

- no reproducible request pattern exists;
- the message is a genuine information-seeking question about a task/deadline rather than a request to perform the task;
- the apparent request is inside quoted/reported text rather than issued by the current speaker;
- a verbless fragment cannot be reproducibly connected to a prior request;
- the request is addressed to an unresolved group with no resolvable reader.

A deadline expression is eligible for force only when it attaches to:
1. the identified requested action; or
2. an external consequence/dependency/accountability clause that is linked to that action.

Example:

> `Do you know if the deck's supposed to be ready before Thursday?`

is an information question about a deadline, not a request to make the deck ready, and MUST be suppressed as `no_head_act` unless another clause independently issues a request.

### 6.2 Hint gates

- Strong hints require a request object/precondition recoverable from the current or prior thread.
- Mild hints require a prior same-sender request with sufficient content overlap.
- Highly elliptical forms such as `needs eyes` are out of scope for v1.1 unless a future rule can classify them reproducibly.

---

## 7. Surface strength

**Definition:** how forcefully the identified request is phrased.

```text
modifierDelta = clamp(
  normalizedDowngraders + normalizedUpgraders,
  -3.0,
  +3.0
)

surface = clamp(baseStrategy + modifierDelta, 0, 10)
```

All patterns, raw values, absorption rules, and normalization constants are canonical in `LEXICON.md`. V1.1 uses the single transparent `modifierDelta` clamp above rather than hidden per-subcategory caps; repeated matches are still subject to the matching and absorption rules in `LEXICON.md`.

### 7.1 CCSARP scale

CCSARP supplies an **ordinal directness backbone**. UnderTone maps those levels onto an operational numeric scale for deterministic scoring. The spacing is an engineering choice and is not claimed to be an interval-scale psychological measurement.

The ordering MUST remain strictly monotonic from L1 to L9 when modifiers are held constant.

### 7.2 Surface-only material

The following are surface evidence wherever they occur in the message, including after a dash or in a separate sentence:

- modal/mood realization of the request;
- syntactic mitigation;
- hedges, downtoners, understaters, apologies, politeness markers;
- optionality/deferral formulas such as `no rush`, `no pressure`, `whenever you get a chance`, `when you can`, `only if you have time`, `feel free to ignore`;
- lexical intensity markers such as `critical`, `urgent`, and `high priority` in v1.1;
- repeated exclamation marks where the lexicon permits them.

A single `!` is not scored.

“Surface-only” names the scorer that is allowed to use a form; it does **not** mean every occurrence in the message automatically modifies the request. A surface expression contributes only when it is attached to the identified request or clearly refers back to it. An unrelated phrase such as `No rush on the other task. Could you send this by 5?` leaves `no rush` unassigned rather than applying it to the second request.

There are **no negative-weight force mitigators in v1.1**.

---

## 8. Communicative force

**Definition:** how strongly observable evidence independent of surface realization makes action expected.

```text
force = clamp(
  3.0
  + temporalContribution
  + consequenceContribution
  + dependencyAccountabilityContribution
  + repetitionEscalationContribution,
  0,
  10
)
```

The baseline `3.0` means: once a request has been reproducibly identified, some expectation of action exists even when no additional pressure evidence is present.

The baseline is not lowered by `no rush`, `no pressure`, or other softening language. Those phrases affect surface strength only.

### 8.1 What is eligible to raise force

Only evidence that independently encodes one of these event types:

1. **Temporal constraint** — a deadline or bounded timing requirement.
2. **Consequence** — a stated downstream outcome if the action does not occur.
3. **Dependency/blockage** — another person, task, process, or deliverable cannot proceed without the action.
4. **Accountability** — a concrete third-party/process commitment that depends on the action. Job title, seniority, department, and organizational rank MUST NOT change this weight; v1 models the presence and specificity of textual accountability, not power.
5. **Repetition/escalation** — verified re-raising of the same request or explicit follow-up framing.

Generic preparators, availability checks, politeness/supportive moves, reward offers, and generic explanations do **not** receive force merely because they occur outside the head act.

There is no generic rule “CCSARP external modification = force.”

### 8.2 Canonical weight summary — generated, non-normative copy

The canonical values live in `LEXICON.md`. This table is a generated summary and MUST be regenerated if the lexicon constants change.

| Component | Raw range | Scale | Maximum normalized lexical contribution before component caps |
|---|---:|---:|---:|
| downgrader | 0.5–3.0 | −0.40 | −1.20 per uncapped trigger |
| upgrader | 0.5–2.5 | +0.40 | +1.00 per uncapped trigger |
| temporal | 0–5.0 | +0.60 | +3.00 |
| consequence | 1.5–3.0 | +0.83 | +2.49 ≈ +2.5 |
| dependency/accountability | 1.0–2.5 | +0.80 | +2.00 |

---

## 9. Temporal reasoning

The lexical ladder and raw weights are canonical in `LEXICON.md`.

### 9.1 Dynamic `today`

Bare `today` MUST NOT map to one static maximum value.

It resolves against `Message.timestamp` and an explicit business-day-end config:

- more than 6 hours remaining → named-day behavior;
- 2–6 hours remaining → date-time behavior;
- under 2 hours remaining → immediate behavior.

If no business-day convention is supplied, use same-offset local 23:59 and set an assumption flag visible in evidence.

### 9.2 Past-due deadlines

Expressions such as:

- `was due yesterday`
- `due yesterday`
- `already overdue`
- `overdue since Monday`
- `was supposed to be in yesterday`

must resolve as past-due evidence. Past due uses the maximum proximity bonus, but does not grow without bound as the deadline gets older.

### 9.3 Proximity

`proximityBonus(deadline, messageTimestamp)` is deterministic and uses only supplied timestamps.

Recommended v1.1 curve, canonical unless changed in `LEXICON.md`:

```text
if unresolved                   -> 0
if h <= 0                       -> MAX
if h >= 336 hours               -> 0
otherwise                       -> MAX * exp(-h / 48)

MAX = 1.5
```

---

## 10. Masking and partition invariant

After head-act detection and surface scoring, the engine creates an offset-preserving masked view.

The mask hides:

- modal verbs belonging to the head act;
- grammatical mood markers belonging to the head act;
- every span consumed as surface downgrader/upgrader evidence when necessary to prevent force reuse;
- quoted/reporting material suppressed by request detection.

Force receives only:

```ts
interface MaskedMessage {
  readonly messageId: MessageId;
  readonly maskedText: string;
  readonly maskedSpans: readonly Span[];
  readonly requestClauseSpan: Span;          // structural boundary only; no strategy/mood label
  readonly requestSignature: readonly string[]; // normalized request content words only
  readonly timestamp: string;
  readonly senderId: string;
  readonly recipientIds: readonly string[];
}
```

### 10.1 Force-pattern discipline

A force regex MUST match the **independent evidence span**, not surface wording bundled around it.

Good:

- match `today`;
- match `before Thursday`;
- match `the filing can't go out until this is signed`;
- match `Legal is blocked on this`.

Bad:

- match `this needs to go out today` as one temporal feature;
- match `drop everything` as a deadline;
- require a visible `should`, `must`, imperative verb, or request modal for a force rule to fire.

If a force rule only works when masked surface material is visible, it is invalid.

Broad consequence/sanction words such as `escalate`, `reopen`, or `loop in` MUST NOT score merely because they are the requested action itself. Such lexical rules are eligible only outside `requestClauseSpan`, or inside a separately segmented outcome clause explicitly linked to the request by a consequence relation. Temporal expressions are the exception: a deadline may legitimately occur inside the request clause (`send it by Friday`) because the time expression itself is independent force evidence.

### 10.2 Surface/force span partition

No character offset may contribute to both surface and force evidence in the same message.

`no rush` remains surface evidence whether it occurs inside the request, after a dash, or as a separate sentence.

---

## 11. Force evidence deduplication

Different regex matches do not automatically represent independent facts.

### 11.1 Same-span rule

If two force matches substantially overlap and describe the same event, only the most specific match contributes.

### 11.2 Same-event rule

Each force evidence item receives an `eventId`. Matches that refer to one underlying deadline, blockage, consequence, accountability commitment, or repeated-request event share the same `eventId`.

Within one event, only the strongest applicable contribution counts unless a rule explicitly defines a subcomponent.

Example:

> `Legal is blocked on this.`

is one blockage/dependency event. It MUST NOT receive both a full consequence score and a full dependency score.

### 11.3 Repetition/escalation cap

Lexical follow-up markers and verified thread repetition are related evidence and share a single component cap.

Canonical v1.1 component:

```text
lexicalFollowUp = strongest normalized follow-up marker, max +1.6
verifiedRestatement:
  2nd mention  +1.0
  3rd mention  +1.8
  4th+         +2.5
accelerating intervals +0.5
unanswered            +0.5

combined repetition/escalation contribution = min(3.0, deduplicated sum)
```

The lexical phrase `third time` and the fact that the request is literally the third occurrence may both be recorded as evidence, but their combined contribution cannot exceed the component cap.

### 11.4 Same-request matching

Shared preprocessing emits `requestSignature`, consisting only of lowercased, lemmatized request content words (nouns, main verbs, and proper nouns; stopwords and all masked modal/mood material removed). It contains no CCSARP strategy level or surface score.

Two requests are treated as the same request when:

1. their request-signature Jaccard similarity is `>= 0.30`; and
2. no intervening recipient message contains a completion signal such as `done`, `sent`, `shipped`, `merged`, `attached`, or `it's in`.

The threshold is an engineering operationalization for v1.1 and MUST remain configurable/tested rather than described as a validated human boundary. Escalation may read `requestSignature`; it MUST NOT read surface strategy, modal, mood, or modifier information.

---

## 12. Confidence

Confidence measures **how reliable this particular rule-based analysis is**, not how certain the sender was and not how likely the recipient is to comply.

```ts
computeConfidence(...): Confidence
```

Confidence MUST depend primarily on:

1. **Head-act detection certainty** — exact request pattern and resolvable addressee vs weak contextual hint.
2. **Partition clarity** — whether surface and force spans separate cleanly.
3. **Independent event count after deduplication** — not raw regex match count.
4. **Lexical ambiguity** — known polysemous/uncertain patterns reduce confidence.
5. **Hard-case flags** — information-seeking ambiguity, quoted text, sarcasm markers, verbless fragments, unresolved dates, etc.

Many overlapping matches MUST NOT raise confidence.

Maximum displayed confidence: `0.95`.

Suggested bands:

- `0.80–0.95`: high confidence
- `0.60–0.79`: moderate
- `<0.60`: low; UI should emphasize the evidence trace and limitation

If request detection is below the suppression threshold, emit no score instead of a low-confidence invented score.

---

## 13. Gap and user-facing language

```text
gap = round1(force) - round1(surface)
```

Recommended diagnostic bands:

| Gap | Band |
|---:|---|
| `>= +3.0` | Under-phrased |
| `+1.0 .. < +3.0` | Mildly under-phrased |
| `> -1.0 .. < +1.0` | Aligned |
| `<= -1.0 .. > -3.0` | Mildly over-phrased |
| `<= -3.0` | Over-phrased |

These are **UnderTone-internal diagnostic bands**, not calibrated human-perception thresholds.

### 13.1 Intent boundary

Permitted subjects for analysis statements include: *the message, the request, the wording, the phrasing, the surrounding language,* and *a reader*.

User-facing output MUST NOT claim what a sender *meant, intended, really wanted, knew, believed,* or was *trying* to do.

Statements about reader effects must be modalized: `likely to`, `tends to`, `at risk of`.

Preferred template:

> Phrased as {strategy_name} ({surface}/10). The surrounding language carries {n} independent marker(s) of expected action ({event_types}), giving a communicative force of {force}/10. Within the UnderTone scale, a reader is likely to under-weight this request by about {gap} points.

Use `over-weight` for a negative gap. Omit the final sentence when `|gap| < 1.0`.

---

## 14. Scope and explicit limitations

**In scope:** US/UK workplace English in plain-text Slack, Teams, and work email threads of at most 200 messages, with a resolvable addressee.

**Out of scope:**

- non-English text;
- family/romantic/social registers;
- sarcasm and irony;
- power/hierarchy modeling;
- emoji/reaction/image/voice-note pragmatics;
- sentiment, harassment, deception, or personality classification;
- unresolved broadcast requests;
- verbless directives that cannot be connected reproducibly to prior context;
- messages containing no request;
- external psychometric or human-perception validity claims.

UnderTone v1.1 is an interpretable engineering instrument, not a general-purpose theory of pragmatics.

---

## 15. Evaluation: specification tests vs construct validation

### 15.1 Specification tests

`EVAL.md` contains **120 minimal pairs**, 20 in each family:

1. `head-act-modality`
2. `head-act-strategy`
3. `internal-modification`
4. `external-only`
5. `deadline-specificity`
6. `escalation`

Families 1–3 primarily manipulate surface while force-bearing context is fixed.

Families 4–6 primarily manipulate force while surface realization is fixed.

The fixtures annotate expected **direction or invariance**, not supposed human “true scores.”

### 15.2 Construct validation

Construct validation would require independent human judgments and/or an external corpus not authored around UnderTone's own rules.

V1.1 does **not** claim to have performed construct validation.

Passing the internal test suite establishes implementation fidelity and internal consistency, not human agreement or psychometric validity.

### 15.3 Release assertions

| # | Assertion | Threshold |
|---|---|---|
| 1 | Conditional mask invariance: in surface-manipulation pairs that preserve request detection, force is unchanged | 100%, hard fail |
| 2 | Surface sensitivity on surface-manipulation pairs | `|Δsurface| >= 1.0` on 100% |
| 3 | Force sensitivity with surface held fixed in force families | `|Δforce| >= 1.0` on 100% |
| 4 | Surface invariance in force families | `|Δsurface| < 1e-9` on 100% |
| 5 | Expected gap direction | >=95% overall |
| 6 | CCSARP ordinal monotonicity with modifiers held constant | strict |
| 7 | Evidence reconstruction and span fidelity | 100%, hard fail |
| 8 | Surface/force partition | 100%, hard fail |
| 9 | Force event deduplication | 100%, hard fail |
| 10 | Determinism | 100%, hard fail |
| 11 | Intent-language guard | 100%, hard fail |
| 12 | Head-act detection against fixture annotation | precision and recall >=0.90 |
| 13 | 50-message performance | <50 ms on target hardware |
| 14 | No diagnostic-engine network egress | 100%, hard fail |

Global correlation or gap spread may be reported descriptively, but **must not be treated as evidence of human validity**, especially because the specification set is deliberately constructed to exercise dissociation.

---

## 16. Non-goals

UnderTone deliberately does not:

1. infer sender intent, motive, sincerity, or character;
2. classify or rank people;
3. detect sarcasm, irony, deception, harassment, or hostility;
4. predict recipient behavior;
5. use an LLM or trained classifier in the v1.1 diagnostic engine;
6. transmit, store, or log message text;
7. support non-English or non-workplace registers;
8. score unresolved non-requests;
9. claim psychometric calibration;
10. provide a hosted message-analysis API or bot in v1.1.

---

## 17. Repository layout

```text
packages/engine/
  src/
    types.ts
    normalize.ts
    segment.ts
    headAct.ts
    mask.ts
    surface/
      score.ts
    force/
      score.ts
      temporal.ts
      dedupe.ts
      escalation.ts
      confidence.ts
    intent-guard/
      banned.ts
      assertNoIntentClaims.ts
    lexicons/
      strategies.ts
      downgraders.ts
      upgraders.ts
      deadlines.ts
      consequences.ts
      dependencies.ts
    index.ts
  test/
    invariants/
    head-act.test.ts
    lexicon-partition.test.ts
    event-dedupe.test.ts
eval/
  minimal-pairs.jsonl
  negative-controls.jsonl
  hard-cases.jsonl
  report.ts
apps/web/
```

There is no `supportiveMoves.ts` force module in v1.1. Generic supportive moves are not force evidence.

`lexicon-partition.test.ts` MUST fail if a normalized surface form has homes in both scorer lexicons without an explicit, non-overlapping span rule.

`event-dedupe.test.ts` MUST fail if one underlying force event contributes twice outside an explicit component rule.
