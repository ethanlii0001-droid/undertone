/**
 * Shared types for the UnderTone engine: Message, Thread, Span, Evidence,
 * Confidence, MessageAnalysis, MaskedMessage, LexEntry, and related aliases.
 * See SPEC.md §4 (Data model) for the normative shape of every interface
 * defined here. No linguistic basis of its own — this file carries the
 * vocabulary the rest of the engine is specified against.
 *
 * ThreadAnalysis is NOT defined in SPEC.md beyond being the named return
 * type of `score(thread, config?) => ThreadAnalysis` (SPEC.md §3) — it is
 * kept deliberately minimal here (just `messages`) rather than growing
 * speculative fields ahead of a normative reason for them. A `rewrite`
 * field previously existed on MessageAnalysis; it has been removed because
 * rewrite has no specification yet (CLAUDE.md "Known gaps" #1) and must
 * not become an API contract early. Add fields back only when SPEC.md (or
 * LEXICON.md/EVAL.md/CLAUDE.md) specifies them.
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
  /**
   * Local business-day-end time, "HH:MM", used by the dynamic `today`/EOD/COB
   * temporal ladder (SPEC.md §9.1). When supplied, it is used directly. When
   * omitted, dynamic `today` falls back to same-offset local 23:59 and an
   * assumption flag is recorded in evidence (SPEC.md §9.1) — there is no
   * silent "17:00" default; the fallback is 23:59, and callers who want
   * 17:00-style business hours must supply it explicitly.
   */
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
 *
 * Only two externally-visible values are canonically evidenced in SPEC.md
 * and EVAL.md, and this type is deliberately restricted to exactly those:
 *
 * - `no_head_act` — SPEC.md §6.1's worked example uses this literal tag for
 *   an information-seeking question (§6.1's example, "Do you know if the
 *   deck's supposed to be ready before Thursday?"). EVAL.md hc-02
 *   (information-seeking question) and hc-05 (unrecoverable verbless
 *   fragment) both use `"suppressed:no_head_act"`. SPEC.md §6.1's "no
 *   reproducible request pattern exists" guard is the same underlying
 *   condition (no head act was identified) and is represented the same way.
 * - `unresolved_addressee` — EVAL.md hc-08 (broadcast request, no
 *   resolvable addressee) uses `"suppressed:unresolved_addressee"`.
 *
 * SPEC.md §6.1's "quoted/reported text" guard has no separately evidenced
 * tag anywhere in SPEC.md/EVAL.md (EVAL.md hc-09 describes the expected
 * behavior in prose, not as a `suppressed:X` string) — it is represented as
 * `no_head_act` here too, since that is the only generally-evidenced "no
 * request was identified" value. If SPEC.md/EVAL.md later introduce a
 * distinct tag for it, add that value then; do not invent one now.
 */
export type SuppressionReason = "no_head_act" | "unresolved_addressee";

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
  suppressed?: SuppressionReason;
}

/**
 * The result of scoring a whole thread: `score(thread, config?) =>
 * ThreadAnalysis` (SPEC.md §3). SPEC.md specifies nothing about this type
 * beyond it being that signature's named return type, so it is kept to
 * exactly what that signature and the current test suite require. An
 * earlier version also had `threadId`, `escalationClusters`, and
 * `gapTrajectory` fields; none of the three are used by any current test,
 * and none are justified by SPEC.md/LEXICON.md/EVAL.md/CLAUDE.md, so they
 * were removed rather than kept as speculative output. Add fields back
 * only when a normative source specifies them.
 */
export interface ThreadAnalysis {
  messages: MessageAnalysis[];
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
