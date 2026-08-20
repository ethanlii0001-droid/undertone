/**
 * Computes Confidence: how reliable this particular rule-based analysis is
 * — not how certain the sender was, and not how likely the recipient is to
 * comply — per SPEC.md §12. Depends primarily on head-act detection
 * certainty, surface/force partition clarity, independent event count
 * after deduplication (not raw regex match count), lexical ambiguity, and
 * hard-case flags. Many overlapping matches must not raise confidence.
 * Maximum displayed confidence is 0.95.
 *
 * SPEC.md §12 gives principles but no exact numeric formula ("Suggested
 * bands", not a spec'd rubric). Prompt 7A fixes one explicit v1 engineering
 * operationalization below. These constants are internal engineering
 * knobs — not calibrated human probabilities, and not a claim about
 * sender certainty or intent (CLAUDE.md rule 5).
 */
import type { Confidence, Evidence, HeadAct, Message, Span } from "../types.js";

// ---------------------------------------------------------------------------
// Rubric constants (Prompt 7A Task 2) — named, never inlined (CLAUDE.md rule 6).
// ---------------------------------------------------------------------------

/** Starting point before any signal is applied. */
export const CONFIDENCE_BASE = 0.4;

/** Bonus: the head act matched an exact, reproducible CCSARP L1–L7 lexical pattern (L8/L9 are not implemented — CLAUDE.md "Known gaps" #4 — and never earn this). */
export const HEAD_ACT_EXACT_BONUS = 0.2;
/** Bonus: the message has at least one resolvable recipient. */
export const RESOLVABLE_ADDRESSEE_BONUS = 0.1;
/** Bonus: no force Evidence span overlaps any surface Evidence span. */
export const CLEAN_PARTITION_BONUS = 0.15;

/** Bonus for exactly one independent force event (post-dedupe). */
export const ONE_FORCE_EVENT_BONUS = 0.05;
/** Bonus (maximum, does not stack further) for two or more independent force events (post-dedupe). */
export const TWO_PLUS_FORCE_EVENTS_BONUS = 0.1;

/** Penalty: a temporal rung matched but its instant could not be resolved (proximity stayed 0 with no resolved instant). */
export const UNRESOLVED_TEMPORAL_PENALTY = 0.15;
/** Penalty: resolution relied on an explicit deterministic calendar/locale assumption (e.g. omitted businessDayEnd -> same-offset 23:59). */
export const TEMPORAL_ASSUMPTION_PENALTY = 0.1;
/** Penalty applied INSTEAD OF CLEAN_PARTITION_BONUS when a force span overlaps a surface span. */
export const PARTITION_OVERLAP_PENALTY = 0.2;

export const CONFIDENCE_MIN = 0;
export const CONFIDENCE_MAX = 0.95;

/** Highest CCSARP directness level this engine currently matches with exact, reproducible lexical evidence (CLAUDE.md "Known gaps" #4: L8/L9 are context-gated and unimplemented here). */
const HEAD_ACT_MAX_EXACT_CCSARP_LEVEL = 7;

/** Literal substring `force/temporal.ts` writes into `temporal.proximity`'s note only when an instant WAS successfully resolved (SPEC.md §9.3). Its absence, combined with weight 0, is how an unresolved instant is distinguished from a resolved-but-beyond-the-proximity-horizon instant (both have weight 0). */
const TEMPORAL_RESOLVED_NOTE_MARKER = "deadline resolves to";
/** Literal marker `force/temporal.ts` writes at the start of every explicit calendar/locale assumption it records (the businessDayEnd 23:59 fallback and the MM/DD/YYYY numeric-date locale guess) — SPEC.md §9.1. */
const TEMPORAL_ASSUMPTION_NOTE_MARKER = "ASSUMPTION:";

// ---------------------------------------------------------------------------
// Ambiguity flags (machine-stable identifiers only — Prompt 7A Task 4)
// ---------------------------------------------------------------------------

const FLAG_SURFACE_FORCE_OVERLAP = "surface_force_overlap";
const FLAG_UNRESOLVED_TEMPORAL = "unresolved_temporal";
const FLAG_TEMPORAL_ASSUMPTION = "temporal_assumption";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** True when `a` and `b` share at least one character position (half-open UTF-16 offsets, SPEC.md §4). */
function spansOverlap(a: Span, b: Span): boolean {
  return a.start < b.end && b.start < a.end;
}

/** SPEC.md §10.2: no character offset may contribute to both surface and force evidence in the same message. */
function hasPartitionOverlap(surfaceEvidence: readonly Evidence[], forceEvidence: readonly Evidence[]): boolean {
  return forceEvidence.some((f) => surfaceEvidence.some((s) => spansOverlap(f.span, s.span)));
}

/**
 * Independent force events after dedupe (SPEC.md §12 point 3): unique
 * `eventId`s among POSITIVE-weight force Evidence only. A zero-weight item
 * (e.g. an unresolved `temporal.proximity`) never creates an event, and
 * `temporal` + `temporal.proximity` sharing one eventId (force/temporal.ts)
 * already collapses to one event automatically via this Set.
 */
function countIndependentForceEvents(forceEvidence: readonly Evidence[]): number {
  const eventIds = new Set<string>();
  for (const e of forceEvidence) {
    if (e.weight > 0) eventIds.add(e.eventId);
  }
  return eventIds.size;
}

/**
 * A temporal rung matched but force/temporal.ts could not resolve it to a
 * calendar instant (`resolveInstant` returned `resolvedAt: null`) — as
 * opposed to a resolved instant that merely sits beyond the proximity
 * horizon, which also has `temporal.proximity` weight 0 but keeps the
 * "deadline resolves to ..." note. Detected via force/temporal.ts's own
 * note convention rather than parsing prose generally (Prompt 7A Task 3).
 */
function hasUnresolvedTemporalInstant(forceEvidence: readonly Evidence[]): boolean {
  return forceEvidence.some(
    (e) => e.category === "temporal" && e.subcategory === "temporal.proximity" && e.weight === 0 && !e.note.includes(TEMPORAL_RESOLVED_NOTE_MARKER),
  );
}

/**
 * Resolution relied on an explicit deterministic calendar/locale assumption
 * — the omitted-`businessDayEnd` same-offset-23:59 fallback or the
 * MM/DD/YYYY numeric-date locale guess (force/temporal.ts). Both are
 * written with the same literal `"ASSUMPTION:"` note prefix.
 */
function hasTemporalAssumption(forceEvidence: readonly Evidence[]): boolean {
  return forceEvidence.some((e) => e.category === "temporal" && e.note.includes(TEMPORAL_ASSUMPTION_NOTE_MARKER));
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

/**
 * How reliable THIS rule-based analysis is (SPEC.md §12) — an engineering
 * confidence in the analysis pipeline itself, never a claim about sender
 * certainty, sender intent, or likelihood of compliance (CLAUDE.md rule 5).
 * Deliberately excludes surface/force numeric score magnitude and raw
 * regex match count as inputs (Prompt 7A Task 1): many overlapping matches
 * must not raise confidence (SPEC.md §12).
 */
export function computeConfidence(message: Message, headAct: HeadAct, surfaceEvidence: readonly Evidence[], forceEvidence: readonly Evidence[]): Confidence {
  const reasons: string[] = [];
  const ambiguityFlags: string[] = [];
  let value = CONFIDENCE_BASE;

  const headActExact = headAct.ccsarpLevel >= 1 && headAct.ccsarpLevel <= HEAD_ACT_MAX_EXACT_CCSARP_LEVEL;
  if (headActExact) {
    value += HEAD_ACT_EXACT_BONUS;
    reasons.push("Exact lexical head-act match");
  } else {
    reasons.push("Head-act match is not an exact reproducible L1-L7 pattern");
  }

  const resolvableAddressee = message.recipientIds.length > 0;
  if (resolvableAddressee) {
    value += RESOLVABLE_ADDRESSEE_BONUS;
    reasons.push("Resolvable addressee");
  } else {
    reasons.push("No resolvable addressee");
  }

  const partitionOverlap = hasPartitionOverlap(surfaceEvidence, forceEvidence);
  if (partitionOverlap) {
    value -= PARTITION_OVERLAP_PENALTY;
    reasons.push("Surface/force partition overlaps");
    ambiguityFlags.push(FLAG_SURFACE_FORCE_OVERLAP);
  } else {
    value += CLEAN_PARTITION_BONUS;
    reasons.push("Surface/force partition is clean");
  }

  const independentForceEventCount = countIndependentForceEvents(forceEvidence);
  if (independentForceEventCount === 1) {
    value += ONE_FORCE_EVENT_BONUS;
  } else if (independentForceEventCount >= 2) {
    value += TWO_PLUS_FORCE_EVENTS_BONUS;
  }
  reasons.push(`${independentForceEventCount} independent force event${independentForceEventCount === 1 ? "" : "s"}`);

  if (hasUnresolvedTemporalInstant(forceEvidence)) {
    value -= UNRESOLVED_TEMPORAL_PENALTY;
    reasons.push("Unresolved temporal instant");
    ambiguityFlags.push(FLAG_UNRESOLVED_TEMPORAL);
  }

  if (hasTemporalAssumption(forceEvidence)) {
    value -= TEMPORAL_ASSUMPTION_PENALTY;
    reasons.push("Explicit temporal/calendar assumption applied");
    ambiguityFlags.push(FLAG_TEMPORAL_ASSUMPTION);
  }

  return {
    value: clamp(value, CONFIDENCE_MIN, CONFIDENCE_MAX),
    reasons: uniqueSorted(reasons),
    ambiguityFlags: uniqueSorted(ambiguityFlags),
  };
}
