/**
 * Computes the repetition/escalation contribution to force, per SPEC.md
 * §11.3–§11.4. Combines the strongest normalized lexical follow-up marker
 * (max +1.6), verified thread restatement counts (+1.0 / +1.8 / +2.5 for
 * 2nd / 3rd / 4th+ mention), and accelerating-interval / unanswered
 * bonuses (+0.5 each), deduplicated and capped at a combined maximum of
 * 3.0 (SPEC.md §11.3).
 *
 * Reads only MaskedMessage data — `requestSignature`, `timestamp`,
 * `senderId`, `recipientIds`, and masked prior messages (CLAUDE.md rule 3;
 * SPEC.md §11.4's own restriction: "Escalation may read requestSignature;
 * it MUST NOT read surface strategy, modal, mood, or modifier
 * information"). Never receives HeadAct, ccsarpLevel, strategyName,
 * surface score, or surface Evidence — its exported function signature
 * only accepts `MaskedMessage` values, so there is nothing else it could
 * read even by mistake.
 */
import type { Evidence, EvidenceCategory, MaskedMessage, Span } from "../types.js";
import { DEPENDENCY, DEPENDENCY_SCALE } from "../lexicons/dependency.js";
import { collectForceMatches, containsCompletionSignal, isSameRequest, type RawForceMatch } from "./dedupe.js";

// ---------------------------------------------------------------------------
// Canonical component constants (SPEC.md §11.3) — named, never inline literals.
// ---------------------------------------------------------------------------

/** Cap on the lexical-follow-up sub-component alone, before combining with the rest (SPEC.md §11.3). */
export const LEXICAL_FOLLOW_UP_CAP = 1.6;
export const VERIFIED_RESTATEMENT_2ND = 1.0;
export const VERIFIED_RESTATEMENT_3RD = 1.8;
export const VERIFIED_RESTATEMENT_4TH_PLUS = 2.5;
export const ACCELERATING_INTERVALS_BONUS = 0.5;
export const UNANSWERED_BONUS = 0.5;
/** Combined repetition/escalation component cap (SPEC.md §11.3, §8). */
export const REPETITION_ESCALATION_CAP = 3.0;

const CAP_EPSILON = 1e-9;

const FOLLOW_UP_ENTRIES = DEPENDENCY.filter((entry) => entry.subcategory === "follow_up");

function deterministicId(messageId: string, category: EvidenceCategory, subcategory: string, span: Span): string {
  return `${messageId}:force:${category}:${subcategory}:${span.start}-${span.end}`;
}

function hoursBetween(fromIso: string, toIso: string): number {
  return (Date.parse(toIso) - Date.parse(fromIso)) / 3_600_000;
}

/**
 * True when `message` could actually have answered/broken the chain for
 * `current`'s request — i.e. it comes from a real recipient of the
 * current request, per `current.recipientIds`, not merely "anyone other
 * than the requester" (Prompt 6R-A Task C). A message from a third party
 * who is neither the requester nor a named recipient (e.g. someone
 * cc'd into an unrelated later message) must not be able to break the
 * chain or suppress the unanswered bonus — the deterministic rule is
 * exactly `current.recipientIds.includes(candidate.senderId)`, no
 * inference about organizational relationships.
 */
function isFromRealRecipient(current: MaskedMessage, message: MaskedMessage): boolean {
  return current.recipientIds.includes(message.senderId);
}

/**
 * Builds the chronological chain of verified same-request mentions from
 * `current.senderId` (SPEC.md §11.4): a prior message from the same
 * sender counts as a verified mention when its requestSignature meets the
 * Jaccard threshold; a message from a REAL RECIPIENT of the current
 * request (Task C) containing a completion signal breaks the chain
 * (everything before it stops counting) — a message from an unrelated
 * third party is ignored entirely, neither extending nor breaking the
 * chain. Only verified same-sender prior requests count — no
 * hierarchy/power modeling (this prompt's Task 7).
 */
function buildVerifiedMentionChain(current: MaskedMessage, priorMessages: readonly MaskedMessage[]): MaskedMessage[] {
  let chain: MaskedMessage[] = [];
  for (const message of priorMessages) {
    if (message.senderId === current.senderId) {
      if (isSameRequest(message.requestSignature, current.requestSignature)) {
        chain.push(message);
      }
      continue;
    }
    if (isFromRealRecipient(current, message) && containsCompletionSignal(message.maskedText)) {
      chain = [];
    }
    // A message from anyone else (neither the requester nor a real recipient) is ignored.
  }
  return chain;
}

function isMaskedAt(current: MaskedMessage, position: number): boolean {
  return current.maskedSpans.some((s) => position >= s.start && position < s.end);
}

/**
 * Earliest maximal run of unmasked alphanumeric characters in
 * `[searchStart, searchEnd)` — the building block for
 * `selectEscalationAnchorSpan` below. Reads only `maskedText`/
 * `maskedSpans`, so it can never surface masked-out (space-replaced)
 * content.
 */
function findFirstUnmaskedWordSpan(current: MaskedMessage, searchStart: number, searchEnd: number): Span | null {
  const text = current.maskedText;
  let i = Math.max(0, searchStart);
  const end = Math.min(searchEnd, text.length);
  while (i < end) {
    if (/[A-Za-z0-9]/.test(text[i] ?? "") && !isMaskedAt(current, i)) {
      let wordEnd = i;
      while (wordEnd < end && /[A-Za-z0-9]/.test(text[wordEnd] ?? "") && !isMaskedAt(current, wordEnd)) wordEnd++;
      return { start: i, end: wordEnd };
    }
    i++;
  }
  return null;
}

/**
 * Selects a deterministic, reproducible, UNMASKED lexical anchor span for
 * synthetic (thread-derived) escalation Evidence — verified_restatement,
 * accelerating_intervals, unanswered — none of which is a literal lexical
 * trigger (Prompt 6R-A Task B). `requestClauseSpan` alone is unsafe to use
 * directly: the head act's own directness/modal realization inside it has
 * already been masked (SPEC.md §10), so a span covering the whole clause
 * can overlap `maskedSpans`.
 *
 * Prefers the earliest unmasked alphanumeric run INSIDE `requestClauseSpan`
 * (normally the request's own content word, e.g. "review" in "Could you
 * review the deck?" once "Could you" is masked). Falls back to the
 * earliest unmasked run anywhere in `maskedText` only if the request
 * clause itself turns out to be entirely masked. Returns `null` — never a
 * span that overlaps masked material — if no unmasked content exists
 * anywhere at all; callers must not emit Evidence in that case (Task B:
 * "do not emit an Evidence span that overlaps masked material merely to
 * force an escalation score").
 *
 * Reads only `MaskedMessage` fields — never CCSARP level, strategy name,
 * SurfaceScore, or HeadAct, which this function's signature doesn't even
 * have access to.
 */
function selectEscalationAnchorSpan(current: MaskedMessage): Span | null {
  const inClause = findFirstUnmaskedWordSpan(current, current.requestClauseSpan.start, current.requestClauseSpan.end);
  if (inClause) return inClause;
  return findFirstUnmaskedWordSpan(current, 0, current.maskedText.length);
}

interface Contribution {
  subcategory: string;
  category: EvidenceCategory;
  value: number;
  span: Span;
  trigger: string;
  note: string;
  citation: string;
  rawWeight: number;
  /**
   * Prompt 6R-F Task 4: true when this contribution's own sub-component cap
   * (currently only `LEXICAL_FOLLOW_UP_CAP`) already reduced its value,
   * independent of whether the combined `REPETITION_ESCALATION_CAP` below
   * also binds. Must still surface as `capped: true` on the final Evidence
   * even when the combined cap does not bind.
   */
  individuallyCapped: boolean;
}

/**
 * Computes the repetition/escalation Evidence for `current`, given every
 * message strictly before it in the thread (any sender, chronological
 * order — needed to see recipient replies for the completion-signal and
 * "unanswered" checks; SPEC.md §11.4).
 */
export function scoreEscalation(current: MaskedMessage, priorMessages: readonly MaskedMessage[]): Evidence[] {
  const contributions: Contribution[] = [];
  // Shared structural anchor for every synthetic (thread-derived) contribution below
  // (Task B) — computed once and reused, per this prompt's explicit instruction.
  const anchorSpan = selectEscalationAnchorSpan(current);
  const anchorTrigger = anchorSpan ? current.maskedText.slice(anchorSpan.start, anchorSpan.end) : "";

  // ── Lexical follow-up: strongest current-message marker only (SPEC.md §11.3). ──
  const followUpMatches = collectForceMatches(FOLLOW_UP_ENTRIES, current.maskedText, DEPENDENCY_SCALE);
  const strongestFollowUp = followUpMatches.reduce<RawForceMatch | null>((best, m) => {
    if (best === null || m.entry.weight * m.scale > best.entry.weight * best.scale) return m;
    return best;
  }, null);
  if (strongestFollowUp) {
    const raw = strongestFollowUp.entry.weight * strongestFollowUp.scale;
    contributions.push({
      subcategory: "follow_up",
      category: "dependency",
      value: Math.min(LEXICAL_FOLLOW_UP_CAP, raw),
      span: strongestFollowUp.span,
      trigger: current.maskedText.slice(strongestFollowUp.span.start, strongestFollowUp.span.end),
      note: strongestFollowUp.entry.note,
      citation: "LEXICON.md §6",
      rawWeight: strongestFollowUp.entry.weight,
      individuallyCapped: raw > LEXICAL_FOLLOW_UP_CAP + CAP_EPSILON,
    });
  }

  // ── Verified thread restatement (SPEC.md §11.4). ──
  const chain = buildVerifiedMentionChain(current, priorMessages);
  const mentionCount = chain.length + 1;
  let verifiedValue = 0;
  if (mentionCount === 2) verifiedValue = VERIFIED_RESTATEMENT_2ND;
  else if (mentionCount === 3) verifiedValue = VERIFIED_RESTATEMENT_3RD;
  else if (mentionCount >= 4) verifiedValue = VERIFIED_RESTATEMENT_4TH_PLUS;

  if (verifiedValue > 0 && anchorSpan) {
    contributions.push({
      subcategory: "verified_restatement",
      category: "escalation",
      value: verifiedValue,
      span: anchorSpan,
      trigger: anchorTrigger,
      note: `Verified thread structure: this is mention #${mentionCount} of the same request (requestSignature Jaccard >= 0.30, no intervening completion signal) — not a literal lexical trigger; span is the earliest unmasked content word in the request clause, used only as a reproducible structural anchor.`,
      citation: "SPEC.md §11.3–§11.4",
      rawWeight: verifiedValue,
      individuallyCapped: false,
    });
  }

  // ── Accelerating intervals: needs >=3 total verified mentions (>=2 prior). ──
  if (chain.length >= 2) {
    const secondLast = chain[chain.length - 2];
    const last = chain[chain.length - 1];
    if (secondLast && last) {
      const interval1 = hoursBetween(secondLast.timestamp, last.timestamp);
      const interval2 = hoursBetween(last.timestamp, current.timestamp);
      if (interval2 < interval1 && anchorSpan) {
        contributions.push({
          subcategory: "accelerating_intervals",
          category: "escalation",
          value: ACCELERATING_INTERVALS_BONUS,
          span: anchorSpan,
          trigger: anchorTrigger,
          note: `Verified thread structure: the interval to this mention (${interval2.toFixed(2)}h) is strictly shorter than the previous interval (${interval1.toFixed(2)}h) — not a literal lexical trigger; span is the earliest unmasked content word in the request clause, used only as a reproducible structural anchor.`,
          citation: "SPEC.md §11.3",
          rawWeight: ACCELERATING_INTERVALS_BONUS,
          individuallyCapped: false,
        });
      }
    }
  }

  // ── Unanswered: no intervening message from a REAL recipient (Task C) since the last verified mention. ──
  // Conservative operationalization (this prompt's Task 7): "any intervening recipient
  // message" rather than attempting to detect a "substantive reply", which would require
  // semantic inference this engine does not perform. A message from an unrelated third
  // party must not suppress this bonus (Task C, case 3).
  if (chain.length >= 1) {
    const lastMention = chain[chain.length - 1];
    if (lastMention) {
      const hasInterveningRecipientMessage = priorMessages.some(
        (message) =>
          isFromRealRecipient(current, message) &&
          Date.parse(message.timestamp) > Date.parse(lastMention.timestamp) &&
          Date.parse(message.timestamp) < Date.parse(current.timestamp),
      );
      if (!hasInterveningRecipientMessage && anchorSpan) {
        contributions.push({
          subcategory: "unanswered",
          category: "escalation",
          value: UNANSWERED_BONUS,
          span: anchorSpan,
          trigger: anchorTrigger,
          note: "Verified thread structure: no message from a real recipient occurs between the prior verified mention and this one — not a literal lexical trigger; span is the earliest unmasked content word in the request clause, used only as a reproducible structural anchor.",
          citation: "SPEC.md §11.3",
          rawWeight: UNANSWERED_BONUS,
          individuallyCapped: false,
        });
      }
    }
  }

  if (contributions.length === 0) return [];

  const uncappedSum = contributions.reduce((sum, c) => sum + c.value, 0);
  const cappedSum = Math.min(REPETITION_ESCALATION_CAP, uncappedSum);
  const capApplied = uncappedSum - cappedSum > CAP_EPSILON;
  const rescale = capApplied && uncappedSum !== 0 ? cappedSum / uncappedSum : 1;

  const eventId = deterministicId(current.messageId, "escalation", "component", current.requestClauseSpan);

  return contributions.map((c) => ({
    id: deterministicId(current.messageId, c.category, c.subcategory, c.span),
    scorer: "force",
    category: c.category,
    subcategory: c.subcategory,
    trigger: c.trigger,
    span: c.span,
    messageId: current.messageId,
    rawWeight: c.rawWeight,
    weight: c.value * rescale,
    // Prompt 6R-F Task 4: capped whenever EITHER the combined 3.0 cap binds OR this
    // contribution's own sub-component cap (e.g. LEXICAL_FOLLOW_UP_CAP) already reduced it —
    // the two are independent, not just the combined-cap condition.
    capped: capApplied || c.individuallyCapped,
    eventId,
    note: c.note,
    citation: c.citation,
  }));
}
