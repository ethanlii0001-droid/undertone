/**
 * Computes communicative force: how strongly evidence independent of
 * surface realization makes action expected, per SPEC.md §8. force =
 * clamp(3.0 + temporalContribution + consequenceContribution +
 * dependencyAccountabilityContribution + repetitionEscalationContribution,
 * 0, 10). The baseline 3.0 represents the expectation of action that exists
 * once a request has been reproducibly identified, independent of any
 * additional pressure evidence (SPEC.md §8). There are no negative-weight
 * force mitigators — `no rush`/`no pressure` cannot lower this baseline
 * (SPEC.md §8; LEXICON.md §7).
 *
 * Independence boundary (CLAUDE.md rule 3): this module operates only on
 * the MaskedMessage produced by mask.ts (SPEC.md §10) plus masked prior
 * thread context — never on the raw Message, HeadAct, surface strategy,
 * surface score, modal verb, grammatical mood marker, or any surface-
 * mitigation span. It imports only lexicons/temporal.ts (via
 * force/temporal.ts), lexicons/consequence.ts, and lexicons/dependency.ts
 * for lexical data — never a surface lexicon.
 */
import type { Config, Evidence, EvidenceCategory, ForceScore, MaskedMessage, Span } from "../types.js";
import { CONSEQUENCE, CONSEQUENCE_SCALE } from "../lexicons/consequence.js";
import { DEPENDENCY, DEPENDENCY_SCALE } from "../lexicons/dependency.js";
import { scoreTemporal } from "./temporal.js";
import { scoreEscalation } from "./escalation.js";
import { collectForceMatches, dedupeSameEvent, dedupeSameSpan, localEventUnitKeyOf, type RawForceMatch } from "./dedupe.js";

/** SPEC.md §8: the expectation-of-action floor once a request has been reproducibly identified. */
export const FORCE_BASELINE = 3.0;
export const FORCE_MIN = 0;
export const FORCE_MAX = 10;
const CLAMP_EPSILON = 1e-9;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function deterministicId(messageId: string, category: EvidenceCategory, subcategory: string, span: Span): string {
  return `${messageId}:force:${category}:${subcategory}:${span.start}-${span.end}`;
}

/** True when `span` sits fully inside `container` (SPEC.md §10.1's requestClauseSpan gate). */
function isFullyInside(span: Span, container: Span): boolean {
  return span.start >= container.start && span.end <= container.end;
}

const DEPENDENCY_NON_FOLLOWUP = DEPENDENCY.filter((entry) => entry.subcategory !== "follow_up");

/**
 * SPEC.md §10.1 / this prompt's Task 5: broad consequence/sanction words
 * (`escalate`, `reopen`, `loop in`, ...) must not score merely because
 * they are the requested action itself. Only entries in consequence.ts's
 * "(b) Sanction lexicon" block carry `subcategory: "sanction"` — the
 * "(a) Conditional-consequence structures" block (`otherwise`, `or else`,
 * `if we miss this`, ...) is never gated, since a conditional connective
 * describes an outcome relation, not a bare sanction verb, and Task 5
 * explicitly requires it to still score even in the same sentence as the
 * request ("Could you send this, or else we'll have to escalate.").
 */
function isGatedBySanctionLeak(match: RawForceMatch, requestClauseSpan: Span): boolean {
  return match.entry.subcategory === "sanction" && isFullyInside(match.span, requestClauseSpan);
}

interface ComponentEvidence {
  evidence: Evidence[];
}

function buildConsequenceComponent(masked: MaskedMessage): ComponentEvidence {
  const raw = collectForceMatches(CONSEQUENCE, masked.maskedText, CONSEQUENCE_SCALE);
  const ungated = raw.filter((m) => !isGatedBySanctionLeak(m, masked.requestClauseSpan));
  const spanDeduped = dedupeSameSpan(ungated);
  // Same-event rule (SPEC.md §11.2), refined to LOCAL EVENT UNITS rather than whole sentences
  // (Prompt 6R-D): every consequence match in the same local unit describes one outcome event
  // (e.g. "otherwise" + "escalate" in "Otherwise we'll escalate.") and dedupes to the
  // strongest; matches in a DIFFERENT local unit of the same sentence (e.g. split by a
  // semicolon: "Otherwise we'll miss the cutoff; Legal will also escalate.") are genuinely
  // independent facts and may both contribute.
  const eventDeduped = dedupeSameEvent(spanDeduped, (m) => localEventUnitKeyOf(masked.maskedText, m.span.start));

  const evidence = eventDeduped.map((m) => {
    const eventId = deterministicId(masked.messageId, "consequence", localEventUnitKeyOf(masked.maskedText, m.span.start), m.span);
    return {
      id: deterministicId(masked.messageId, "consequence", m.entry.subcategory, m.span),
      scorer: "force" as const,
      category: "consequence" as const,
      subcategory: m.entry.subcategory,
      trigger: masked.maskedText.slice(m.span.start, m.span.end),
      span: m.span,
      messageId: masked.messageId,
      rawWeight: m.entry.weight,
      weight: m.entry.weight * m.scale,
      capped: false,
      eventId,
      note: m.entry.note,
      citation: "LEXICON.md §5",
    };
  });
  return { evidence };
}

function buildDependencyComponent(masked: MaskedMessage): ComponentEvidence {
  const raw = collectForceMatches(DEPENDENCY_NON_FOLLOWUP, masked.maskedText, DEPENDENCY_SCALE);
  const spanDeduped = dedupeSameSpan(raw);
  // Same-event rule, refined to LOCAL EVENT UNITS rather than whole sentences (Prompt 6R-D):
  // merge within the SAME subcategory in the same local unit only — "framing" (blockage) and
  // "accountability" (who is asking) stay genuinely distinct facts (SPEC.md §8.1 point 3 vs
  // point 4), and two matches of the SAME subcategory in different local units of one
  // sentence (e.g. "The client is asking; my boss is asking.") are now correctly recognized
  // as two independent accountability facts rather than merged by sentence identity alone.
  const eventGroupKey = (m: RawForceMatch) => `${m.entry.subcategory}:${localEventUnitKeyOf(masked.maskedText, m.span.start)}`;
  const eventDeduped = dedupeSameEvent(spanDeduped, eventGroupKey);

  const evidence = eventDeduped.map((m) => {
    const category: EvidenceCategory = "dependency";
    const eventId = deterministicId(masked.messageId, category, eventGroupKey(m), m.span);
    return {
      id: deterministicId(masked.messageId, category, m.entry.subcategory, m.span),
      scorer: "force" as const,
      category,
      subcategory: m.entry.subcategory,
      trigger: masked.maskedText.slice(m.span.start, m.span.end),
      span: m.span,
      messageId: masked.messageId,
      rawWeight: m.entry.weight,
      weight: m.entry.weight * m.scale,
      capped: false,
      eventId,
      note: m.entry.note,
      citation: "LEXICON.md §6",
    };
  });
  return { evidence };
}

/**
 * Communicative force scorer (SPEC.md §8). `message` must be the
 * MaskedMessage for the request currently being scored; `priorMessages`
 * must be every masked message strictly before it in the same thread, in
 * chronological order (needed by force/escalation.ts for the verified-
 * restatement and unanswered checks — SPEC.md §11.4).
 */
export function scoreForce(message: MaskedMessage, priorMessages: readonly MaskedMessage[], config?: Config): ForceScore {
  const temporalEvidence = scoreTemporal(message, config);
  const consequenceEvidence = buildConsequenceComponent(message).evidence;
  const dependencyEvidence = buildDependencyComponent(message).evidence;
  const escalationEvidence = scoreEscalation(message, priorMessages);

  const allEvidence = [...temporalEvidence, ...consequenceEvidence, ...dependencyEvidence, ...escalationEvidence];
  const uncappedTotal = allEvidence.reduce((sum, e) => sum + e.weight, 0);
  const force = clamp(FORCE_BASELINE + uncappedTotal, FORCE_MIN, FORCE_MAX);
  const effectiveContribution = force - FORCE_BASELINE;

  // Final-clamp Evidence bookkeeping (this prompt's Task 8): reconstructs `force - 3.0`
  // across all contributing Evidence when the outer [0,10] clamp binds. This is bookkeeping
  // for evidence reconstruction, not a new linguistic weighting rule — see surface/score.ts's
  // identical treatment of its own aggregate clamp for the established precedent.
  //
  // Prompt 6R-F Task 5: the outer clamp only ever proportionally rescales POSITIVE
  // contributing Evidence — a zero-weight item (e.g. an unresolved temporal.proximity, which
  // legitimately contributes 0) is left at weight 0 with its existing `capped` state
  // preserved, never forced to `capped: true` merely because the clamp bound elsewhere.
  // Rescaling 0 by any factor is still 0, so `force - 3.0` still reconstructs exactly.
  const capApplied = Math.abs(uncappedTotal - effectiveContribution) > CLAMP_EPSILON;
  const rescale = capApplied && uncappedTotal !== 0 ? effectiveContribution / uncappedTotal : 1;

  const evidence = capApplied
    ? allEvidence.map((e) => (e.weight > 0 ? { ...e, weight: e.weight * rescale, capped: true } : e))
    : allEvidence;

  return { value: force, evidence };
}
