/**
 * Shared types for the UnderTone engine: Message, Thread, Span, Evidence,
 * Confidence, MessageAnalysis, MaskedMessage, LexEntry, and related aliases.
 * See SPEC.md §4 (Data model) for the normative shape of every interface
 * defined here. No linguistic basis of its own — this file carries the
 * vocabulary the rest of the engine is specified against.
 *
 * ThreadAnalysis, EscalationCluster, GapTrajectoryPoint, and Rewrite are NOT
 * defined in SPEC.md — they are designed here because the engine's public
 * API (SPEC.md §3: `score(thread, config?) => ThreadAnalysis`) needs a
 * return type that doesn't exist yet. Treat these as a proposal: SPEC.md
 * should eventually be updated to make them normative, the same way
 * CLAUDE.md's "Known gaps" tracks rewrite.ts having no rules yet.
 */

// ---------------------------------------------------------------------------
// Identifiers and spans
// ---------------------------------------------------------------------------

export type MessageId = string;

/** Half-open UTF-16 character offsets into the original, un-normalized message text. SPEC.md §4. */
export interface Span {
  start: number;
  end: number;
}

/** Which independent scorer produced a piece of evidence. SPEC.md §4, §5.1. */
export type Scorer = "surface" | "force";

// ---------------------------------------------------------------------------
// Input model
// ---------------------------------------------------------------------------

/** A single workplace message. SPEC.md §4. */
export interface Message {
  id: MessageId;
  threadId: string;
  senderId: string;
  recipientIds: string[];
  mentionedIds: string[];
  /** ISO 8601 with explicit UTC offset. Never resolved against the wall clock (CLAUDE.md rule 1). */
  timestamp: string;
  text: string;
}

/** A whole thread, messages in ascending timestamp order. SPEC.md §4. */
export interface Thread {
  id: string;
  messages: Message[];
}

/**
 * Explicit, caller-supplied assumptions the engine may use instead of an
 * implicit runtime locale/clock (CLAUDE.md rule 1; SPEC.md §3, §9.1).
 * Deliberately small today — extend only when a scoring rule needs a new
 * explicit assumption, never to smuggle in an implicit default.
 */
export interface Config {
  /** Local business-day-end time, "HH:MM", used by the dynamic `today`/EOD/COB temporal ladder (SPEC.md §9.1). Defaults to "17:00" with an assumption flag recorded in evidence if omitted. */
  businessDayEnd?: string;
}

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

/**
 * The linguistic category a piece of evidence belongs to. The first six
 * values are one-to-one with the six lexicon files (LEXICON.md §1–§6):
 * `directness` (surface base strategy), `downgrader`/`upgrader` (surface
 * internal modification), `temporal`/`consequence`/`dependency` (force).
 * `accountability` is the accountability event type of SPEC.md §8.1 point 4
 * — textually distinct from `dependency` (point 3) even though both are
 * defined in LEXICON.md §6. `follow_up` is a lexical repetition/escalation
 * marker (SPEC.md §11.3's "lexical follow-up marker" component);
 * `escalation` is verified cross-message restatement (SPEC.md §11.3's
 * "verified restatement" component, SPEC.md §11.4). Both share one combined
 * component cap even though they're tagged separately.
 *
 * Deliberately excludes a "power"/hierarchy category: SPEC.md §8.1 point 4
 * and §14 explicitly rule out modeling job title, seniority, department, or
 * organizational rank in v1.1.
 */
export type EvidenceCategory =
  | "directness"
  | "downgrader"
  | "upgrader"
  | "temporal"
  | "consequence"
  | "dependency"
  | "accountability"
  | "follow_up"
  | "escalation";

/**
 * One traceable unit of linguistic evidence behind a score. SPEC.md §4.
 * No score is ever emitted without an Evidence array (CLAUDE.md rule 4).
 * `rawWeight` is the unsigned salience magnitude as authored in the
 * lexicon; `weight` is the signed, scaled contribution after the scorer
 * applies SCALE (LEXICON.md §0.1) and any clamp. `capped` records whether
 * this contribution was reduced by a component cap (SPEC.md §7, §11.3).
 * `eventId` groups matches that describe the same underlying pragmatic
 * event for dedup purposes (SPEC.md §11.2); uncapped/undeduplicated
 * matches still get a unique `eventId`.
 */
export interface Evidence {
  id: string;
  scorer: Scorer;
  category: EvidenceCategory;
  subcategory: string;
  trigger: string;
  span: Span;
  messageId: MessageId;
  rawWeight: number;
  weight: number;
  capped: boolean;
  eventId: string;
  /** Mandatory: what this form does pragmatically and why this weight (LEXICON.md §0). */
  note: string;
  /** Pointer back to the authoring source, e.g. a LEXICON.md section/line. */
  citation: string;
}

// ---------------------------------------------------------------------------
// Head act
// ---------------------------------------------------------------------------

/**
 * The identified request clause (CLAUDE.md glossary: "Head act"), per
 * SPEC.md §6. `ccsarpLevel` is the matched CCSARP directness level (1–9,
 * LEXICON.md §1); `strategyName` names the specific matched strategy
 * pattern (e.g. "want_statement", "ability_question") for evidence
 * traceability. `verb`/`object` are the extracted lemmatized head of the
 * requested action and its direct object, the basis for the
 * `requestSignature` used in same-request matching (SPEC.md §11.4).
 */
export interface HeadAct {
  span: Span;
  ccsarpLevel: number;
  strategyName: string;
  verb: string;
  object: string;
}

// ---------------------------------------------------------------------------
// Scores
// ---------------------------------------------------------------------------

/**
 * Internal result of the surface scorer (packages/engine/src/surface/score.ts)
 * before it's flattened into MessageAnalysis's flat surface/surfaceEvidence
 * fields (SPEC.md §4, §7). `ccsarpLevel` echoes HeadAct.ccsarpLevel — kept
 * here too because it's the base value this specific score was computed
 * from, not merely a fact about the detected clause.
 */
export interface SurfaceScore {
  value: number;
  ccsarpLevel: number;
  evidence: Evidence[];
}

/**
 * Internal result of the force scorer (packages/engine/src/force/score.ts)
 * before it's flattened into MessageAnalysis's flat force/forceEvidence
 * fields (SPEC.md §4, §8).
 */
export interface ForceScore {
  value: number;
  evidence: Evidence[];
}

/**
 * The five-band classification of MessageAnalysis.gap (SPEC.md §13):
 * `under-phrased` (gap >= +3.0), `mildly-under-phrased` (+1.0 to <+3.0),
 * `aligned` (>-1.0 to <+1.0), `mildly-over-phrased` (<=-1.0 to >-3.0),
 * `over-phrased` (<=-3.0).
 */
export type GapBand =
  | "under-phrased"
  | "mildly-under-phrased"
  | "aligned"
  | "mildly-over-phrased"
  | "over-phrased";

/**
 * Why no score was emitted for a message, per the request-detection guards
 * of SPEC.md §6.1. Suppression is the required outcome when no reproducible
 * request can be identified — never a guessed low score (CLAUDE.md rule 4).
 */
export type SuppressionReason =
  | "no_request_pattern"
  | "information_seeking_question"
  | "quoted_or_reported_text"
  | "unlinkable_verbless_fragment"
  | "unresolved_group_addressee";

/**
 * How reliable this rule-based analysis is — not how certain the sender
 * was, and not how likely the recipient is to comply (SPEC.md §12).
 * Maximum displayed value is 0.95.
 */
export interface Confidence {
  value: number;
  reasons: string[];
  ambiguityFlags: string[];
}

// ---------------------------------------------------------------------------
// Rewrite (NOT YET SPECIFIED — see CLAUDE.md "Known gaps" #1)
// ---------------------------------------------------------------------------

/**
 * A deterministic, force-preserving rewrite of a message's head act.
 * Typed now so MessageAnalysis has a stable shape; do not implement the
 * generator until rewrite rules exist in SPEC.md/LEXICON.md and fixtures
 * exist in EVAL.md/eval/ (CLAUDE.md "Known gaps" #1, rule 8). Until then,
 * every MessageAnalysis.rewrite is `null`.
 */
export interface Rewrite {
  text: string;
  transformations: Array<{ rule: string; before: string; after: string }>;
}

// ---------------------------------------------------------------------------
// Per-message and per-thread results
// ---------------------------------------------------------------------------

/**
 * The full analysis of one message, per SPEC.md §4. Deliberately flat
 * (surface/force/surfaceEvidence/forceEvidence as separate fields, not a
 * nested SurfaceScore/ForceScore) to match SPEC.md §4 exactly.
 * `surface`, `force`, `gap`, `band`, and `confidence` are all `null`
 * whenever no reproducible request is identified or a suppression rule
 * fires (SPEC.md §4, §6.1) — `suppressed` names which guard fired.
 */
export interface MessageAnalysis {
  messageId: MessageId;
  headAct: HeadAct | null;
  surface: number | null;
  force: number | null;
  gap: number | null;
  band: GapBand | null;
  confidence: Confidence | null;
  surfaceEvidence: Evidence[];
  forceEvidence: Evidence[];
  rewrite: Rewrite | null;
  suppressed?: SuppressionReason;
}

/**
 * One group of messages verified to be re-raising the same request, per
 * SPEC.md §11.2 (shared eventId) and §11.4 (requestSignature matching).
 * NOT YET SPECIFIED in SPEC.md as a named type — see file-level note above.
 */
export interface EscalationCluster {
  eventId: string;
  messageIds: MessageId[];
  requestSignature: string[];
}

/** One point in a thread's gap trajectory. NOT YET SPECIFIED in SPEC.md — see file-level note above. */
export interface GapTrajectoryPoint {
  messageId: MessageId;
  gap: number | null;
}

/**
 * The result of scoring a whole thread: `score(thread, config?) =>
 * ThreadAnalysis` (SPEC.md §3). NOT YET SPECIFIED as a named type in
 * SPEC.md — see file-level note above. `escalationClusters` surfaces
 * SPEC.md §11's repeated-request grouping at the thread level;
 * `gapTrajectory` is one GapTrajectoryPoint per message in thread order,
 * letting a caller see whether the gap is widening/narrowing/flat across a
 * conversation without recomputing it from `messages`.
 */
export interface ThreadAnalysis {
  threadId: string;
  messages: MessageAnalysis[];
  escalationClusters: EscalationCluster[];
  gapTrajectory: GapTrajectoryPoint[];
}

// ---------------------------------------------------------------------------
// Masking (SPEC.md §10)
// ---------------------------------------------------------------------------

/**
 * The offset-preserving view the force scorer receives instead of the raw
 * Message, per SPEC.md §10. This is the mechanism that enforces the
 * surface/force independence claim (SPEC.md §5.1; CLAUDE.md rule 3).
 */
export interface MaskedMessage {
  readonly messageId: MessageId;
  readonly maskedText: string;
  readonly maskedSpans: readonly Span[];
  /** Structural boundary only — no strategy/mood label (SPEC.md §10). */
  readonly requestClauseSpan: Span;
  /** Lowercased, lemmatized request content words only — no CCSARP level or surface score (SPEC.md §11.4). */
  readonly requestSignature: readonly string[];
  readonly timestamp: string;
  readonly senderId: string;
  readonly recipientIds: readonly string[];
}

// ---------------------------------------------------------------------------
// Lexicon entries (LEXICON.md §0)
// ---------------------------------------------------------------------------

/** One lexicon pattern definition, shared shape across all six lexicon files. LEXICON.md §0. */
export interface LexEntry {
  pattern: string | RegExp;
  weight: number;
  category: EvidenceCategory;
  subcategory: string;
  /** Mandatory: what this form does pragmatically, and why this weight. */
  note: string;
}
