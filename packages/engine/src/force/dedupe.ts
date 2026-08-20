/**
 * Deduplicates force evidence into independent pragmatic events, per
 * SPEC.md §11 and LEXICON.md §0.4 rules 6–7. Implements the same-span rule
 * (§11.1: substantially overlapping matches describing one event — only
 * the most specific/strongest contributes) and a same-event grouping
 * utility (§11.2: matches sharing one eventId contribute their strongest
 * applicable value, not a sum) that force/score.ts uses to merge, e.g.,
 * `otherwise` + `escalate` in "Otherwise we'll escalate." into one
 * consequence event rather than two.
 *
 * Also hosts the shared per-sentence lexicon scan (LEXICON.md §0.4 rules
 * 2 and 4: never across a sentence boundary; a pattern firing more than
 * once in one clause counts once) that force/score.ts uses for both
 * consequence.ts and dependency.ts.
 */
import type { LexEntry, Span } from "../types.js";
import { segmentSentences } from "../segment.js";

export interface RawForceMatch {
  entry: LexEntry;
  /** Absolute offsets into maskedText. */
  span: Span;
  /** The SCALE constant for this entry's lexicon (e.g. CONSEQUENCE_SCALE). */
  scale: number;
}

/**
 * Scans every sentence of `maskedText` against every entry in `entries`,
 * taking the first match per entry per sentence (LEXICON.md §0.4 rule 4:
 * "a pattern that fires more than once in the same clause counts once").
 * No pattern ever sees text spanning a sentence boundary (rule 2), since
 * each sentence is matched against independently.
 */
export function collectForceMatches(entries: readonly LexEntry[], maskedText: string, scale: number): RawForceMatch[] {
  const results: RawForceMatch[] = [];
  for (const sentenceSpan of segmentSentences(maskedText)) {
    const clause = maskedText.slice(sentenceSpan.start, sentenceSpan.end);
    for (const entry of entries) {
      if (typeof entry.pattern === "string") continue;
      const match = entry.pattern.exec(clause);
      if (!match) continue;
      results.push({
        entry,
        scale,
        span: { start: sentenceSpan.start + match.index, end: sentenceSpan.start + match.index + match[0].length },
      });
    }
  }
  return results;
}

function contribution(match: RawForceMatch): number {
  return match.entry.weight * match.scale;
}

/**
 * SPEC.md §11.1: if two matches substantially overlap (their spans
 * intersect at all) and describe one event, only the most specific
 * contributes. Deterministic tiebreak, in order: (1) larger normalized
 * contribution, (2) longer span, (3) earlier source span, (4) original
 * collection order — matching this prompt's Task 6A exactly.
 */
export function dedupeSameSpan<T extends RawForceMatch>(matches: readonly T[]): T[] {
  const ranked = matches
    .map((m, index) => ({ m, index }))
    .sort((a, b) => {
      const byContribution = contribution(b.m) - contribution(a.m);
      if (byContribution !== 0) return byContribution;
      const byLength = b.m.span.end - b.m.span.start - (a.m.span.end - a.m.span.start);
      if (byLength !== 0) return byLength;
      const byStart = a.m.span.start - b.m.span.start;
      if (byStart !== 0) return byStart;
      return a.index - b.index;
    });

  const kept: T[] = [];
  for (const { m: candidate } of ranked) {
    const overlaps = kept.some((k) => candidate.span.start < k.span.end && candidate.span.end > k.span.start);
    if (!overlaps) kept.push(candidate);
  }
  // Restore original collection order for downstream determinism.
  return matches.filter((m) => kept.includes(m));
}

/**
 * SPEC.md §11.2: distinct, non-overlapping matches that restate one
 * underlying event (grouped by a caller-supplied key — e.g. "same
 * sentence, same broad event type") share that event's cap: only the
 * strongest contribution in each group survives, never a sum. Category
 * labels alone never make two matches independent (LEXICON.md §0.4 rule
 * 7) — the grouping key is the caller's responsibility to define per
 * SPEC.md's event types (deadline/blockage/consequence/accountability/
 * repetition).
 */
export function dedupeSameEvent<T extends RawForceMatch>(matches: readonly T[], keyFn: (match: T) => string): T[] {
  const groups = new Map<string, T[]>();
  for (const match of matches) {
    const key = keyFn(match);
    const list = groups.get(key) ?? [];
    list.push(match);
    groups.set(key, list);
  }

  const winners: T[] = [];
  for (const group of groups.values()) {
    const ranked = [...group].sort((a, b) => {
      const byContribution = contribution(b) - contribution(a);
      if (byContribution !== 0) return byContribution;
      const byLength = b.span.end - b.span.start - (a.span.end - a.span.start);
      if (byLength !== 0) return byLength;
      return a.span.start - b.span.start;
    });
    const winner = ranked[0];
    if (winner) winners.push(winner);
  }
  // Restore original collection order for downstream determinism.
  return matches.filter((m) => winners.includes(m));
}

/** The 0-based index of the sentence (from `segmentSentences(maskedText)`) containing `position`, or -1 if none. */
export function sentenceIndexOf(maskedText: string, position: number): number {
  const sentences = segmentSentences(maskedText);
  return sentences.findIndex((s) => position >= s.start && position < s.end);
}

// ---------------------------------------------------------------------------
// Local event units (Prompt 6R-D) — a finer grouping key than "whole
// sentence" for §11.2 same-event dedupe. Sentence identity alone does not
// prove two lexical matches describe one underlying pragmatic event: "X;
// Y also escalates" is one sentence but plainly two independent clauses.
// ---------------------------------------------------------------------------

/**
 * A comma immediately followed by a coordinating conjunction (and/but/so)
 * that itself introduces a new clause with its own subject — a capitalized
 * word, a subject pronoun, or a possessive determiner starting a subject
 * noun phrase ("my boss", "our team") — immediately after. Deliberately
 * does NOT match a bare "and" with no preceding comma, nor a
 * comma+conjunction followed by an ordinary lowercase verb/object word
 * (e.g. "review, edit, and format the document" must stay one unit). This
 * is the standard written-English signal for a coordinated independent
 * clause boundary — conservative and reproducible, never "blind" splitting
 * on every "and" (Prompt 6R-D Task 1's explicit warning).
 */
const COORDINATING_CLAUSE_BOUNDARY_RE =
  /,\s+(?:and|but|so)\s+(?=[A-Z][a-z]*\b|I\b|we\b|they\b|he\b|she\b|it\b|you\b|my\b|our\b|your\b|his\b|her\b|their\b)/g;

/** Strong clause-boundary delimiters within one sentence: semicolon, em dash, and the coordinating-clause boundary above (Prompt 6R-D Task 1). */
function findLocalUnitDelimiters(text: string): Span[] {
  const delimiters: Span[] = [];
  const semiEmDashRe = /[;—]/g;
  let match: RegExpExecArray | null;
  while ((match = semiEmDashRe.exec(text)) !== null) {
    delimiters.push({ start: match.index, end: match.index + match[0].length });
  }
  const coordRe = new RegExp(COORDINATING_CLAUSE_BOUNDARY_RE.source, COORDINATING_CLAUSE_BOUNDARY_RE.flags);
  while ((match = coordRe.exec(text)) !== null) {
    delimiters.push({ start: match.index, end: match.index + match[0].length });
  }
  delimiters.sort((a, b) => a.start - b.start);
  return delimiters;
}

/**
 * Splits `text` (normally one sentence) into local event units at the
 * strong clause boundaries above. Matches whose spans overlap are always
 * treated as same-event candidates regardless of this segmentation
 * (SPEC.md §11.1's overlap rule runs first, unconditionally, before any
 * caller ever applies this); this segmentation only disambiguates
 * NON-overlapping matches within one sentence.
 */
export function splitIntoLocalEventUnits(text: string): Span[] {
  const delimiters = findLocalUnitDelimiters(text);
  const units: Span[] = [];
  let cursor = 0;
  for (const delimiter of delimiters) {
    if (delimiter.start < cursor) continue; // defensive: skip an overlapping delimiter match
    units.push({ start: cursor, end: delimiter.start });
    cursor = delimiter.end;
  }
  units.push({ start: cursor, end: text.length });
  return units;
}

/**
 * Deterministic same-event grouping key combining sentence index and
 * local-unit index within that sentence, for a position in `maskedText`
 * (Prompt 6R-D). Two matches in the same sentence but different local
 * units (e.g. split by a semicolon) get different keys and may contribute
 * independently; two matches in the same local unit still share a key and
 * are deduped to their strongest contribution (§11.2).
 */
export function localEventUnitKeyOf(maskedText: string, position: number): string {
  const sentences = segmentSentences(maskedText);
  const sentenceIndex = sentences.findIndex((s) => position >= s.start && position < s.end);
  if (sentenceIndex === -1) return `sentence:none:${position}`;
  const sentenceSpan = sentences[sentenceIndex] as Span;
  const relativePosition = position - sentenceSpan.start;
  const units = splitIntoLocalEventUnits(maskedText.slice(sentenceSpan.start, sentenceSpan.end));
  const unitIndex = units.findIndex((u) => relativePosition >= u.start && relativePosition < u.end);
  return `sentence:${sentenceIndex}:unit:${unitIndex === -1 ? 0 : unitIndex}`;
}

// ---------------------------------------------------------------------------
// Same-request matching (SPEC.md §11.4) — used by force/escalation.ts.
// ---------------------------------------------------------------------------

/** Jaccard similarity threshold for treating two requestSignatures as the same request (SPEC.md §11.4). An engineering operationalization, not a validated human boundary — kept as a named, tested constant rather than an inline literal. */
export const SAME_REQUEST_JACCARD_THRESHOLD = 0.3;

/**
 * Deterministic token/string completion-signal set (SPEC.md §11.4): an
 * intervening recipient message containing one of these breaks the
 * same-request chain. Matched as a case-insensitive substring — no
 * semantic embeddings, per this prompt's explicit instruction.
 */
export const COMPLETION_SIGNALS: readonly string[] = ["done", "sent", "shipped", "merged", "attached", "it's in"];

export function containsCompletionSignal(text: string): boolean {
  const lower = text.toLowerCase();
  return COMPLETION_SIGNALS.some((signal) => lower.includes(signal));
}

/** Jaccard similarity of two requestSignatures, treated as sets (SPEC.md §11.4). Two empty signatures are defined as dissimilar (0), never vacuously "the same request". */
export function requestSignatureJaccard(a: readonly string[], b: readonly string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersectionSize = 0;
  for (const token of setA) if (setB.has(token)) intersectionSize += 1;
  const unionSize = setA.size + setB.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

/** True when `signature` is reproducibly the same request as `reference`, per SPEC.md §11.4's threshold. */
export function isSameRequest(signature: readonly string[], reference: readonly string[]): boolean {
  return requestSignatureJaccard(signature, reference) >= SAME_REQUEST_JACCARD_THRESHOLD;
}
