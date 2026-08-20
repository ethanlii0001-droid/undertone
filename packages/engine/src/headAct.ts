/**
 * Identifies whether a message contains a reproducible request and locates
 * its head act — the minimal clause that realizes the request (see
 * CLAUDE.md glossary: "Head act"). Per SPEC.md §6, the detector matches
 * clauses against the CCSARP strategy inventory in LEXICON.md §1
 * (lexicons/directness.ts) and takes the most direct matching strategy;
 * ties go to the earliest span.
 *
 * The lexicon itself IS the strategy inventory — this file contains no
 * second, hand-written list of imperative/could-you/want-statement/
 * suggestory/obligation regexes. All matching goes through
 * `matchDirectness`: the canonical `DIRECTNESS` array stays pre-sorted
 * most-direct-first (LEXICON.md §0.4 rule 1, "do not re-sort"), but
 * picking a winner is a two-pass scan, not a single first-hit — first the
 * most-direct CCSARP level with any match in the clause, then, among
 * matches at that level, the earliest source span (SPEC.md §6). Reused by
 * surface/score.ts to reconstruct the same match for Evidence.
 *
 * SPEC.md describes the head act as a clause, but this pipeline has no
 * reproducible general-purpose clause-boundary algorithm (LEXICON.md
 * supplies none, and inventing one would be exactly the kind of ungrounded
 * heuristic CLAUDE.md rule 8 exists to prevent). `HeadAct.span` is
 * therefore the narrowest reproducible structural span this pipeline
 * actually has: the sentence span from segment.ts. Full clause-level
 * completeness is explicitly NOT claimed.
 *
 * SCOPE, matching CLAUDE.md "Known gaps" #4:
 * - Only CCSARP levels 1–7 are ever selected as a head act here. Levels 8
 *   (strong hint) and 9 (mild hint) are context-gated by SPEC.md §6.2 —
 *   L8 requires the request object/precondition to be reproducibly
 *   recoverable, and L9 requires a prior same-sender request meeting the
 *   §11.4 requestSignature overlap gate. This function's (text, sentences)
 *   signature receives no Thread/prior-message context, so firing L8/L9
 *   here would violate the gate; they are left `it.todo` in
 *   head-act.test.ts rather than fired unconditionally or faked.
 * - The SPEC.md §6.1 quote/reported-text guard IS implemented (see
 *   `isQuotedSpan`) because it is reproducible from `text` alone: a
 *   directness match wrapped in quotation marks (straight `"` or curly
 *   `“…”`) is not scored as the current speaker's own directive
 *   (EVAL.md hc-09).
 * - The SPEC.md §6.1 unresolved-addressee guard is NOT implemented here:
 *   it needs `Message.recipientIds`, which this function does not receive.
 *   Left `it.todo`.
 * - The verbless-fragment guard needs no separate code: a fragment with no
 *   verb simply matches no DIRECTNESS pattern, so it already returns
 *   `null` (the safe suppress-rather-than-guess direction).
 *
 * Signature note: the request as literally specified,
 * `identifyHeadAct(sentences: Span[]): HeadAct | null`, is unusable —
 * spans without the string they index into carry no content to classify.
 * This takes `text` as well, matching how every other span-producing
 * function in this codebase is actually called (e.g.
 * `identifyHeadAct(text, segmentSentences(text))`).
 */
import type { HeadAct, LexEntry, Span } from "./types.js";
import { DIRECTNESS, DIRECTNESS_LEVEL_BY_SUBCATEGORY } from "./lexicons/directness.js";

/** Highest CCSARP level `identifyHeadAct` will select as a head act. L8/L9 are context-gated and excluded — see this file's doc comment. */
const MAX_REPRODUCIBLE_LEVEL = 7;

export interface DirectnessMatch {
  entry: LexEntry;
  /** Relative to the clause text passed in, not the original message. */
  span: Span;
}

/**
 * Most-direct-first scan of one clause against the canonical `DIRECTNESS`
 * array (LEXICON.md §0.4 rule 1: "arrays below are pre-sorted; do not
 * re-sort"), per SPEC.md §6: choose the most direct matching CCSARP level,
 * and among matches AT THAT LEVEL, the earliest source span.
 *
 * This is a two-pass scan, not a single "first array entry that matches":
 * pass 1 finds the most-direct LEVEL with any match at all (array order,
 * first hit — since the array is pre-sorted most-direct-first, the first
 * entry anywhere in the array with a hit names that level); pass 2 then
 * scans every entry AT THAT LEVEL and keeps the one with the smallest
 * `match.index`, breaking a same-offset tie by array order. A naive
 * single-pass "return on first array-entry match" is wrong here: within
 * one level, entries are not ordered by where they occur in the text, so
 * e.g. `can you` (listed before `could you` in L7) can match later in a
 * clause than `could you` does, and a single-pass scan would wrongly
 * return the later "can you" match instead of the earlier "could you" one.
 *
 * Returns the minimal span the winning regex itself matched (LEXICON.md
 * §0.4 rule 3). Exported so surface/score.ts can reconstruct the exact
 * same match for Evidence without a second, independent implementation of
 * this scan.
 */
export function matchDirectness(clauseText: string): DirectnessMatch | null {
  let targetLevel: number | undefined;
  for (const entry of DIRECTNESS) {
    if (typeof entry.pattern === "string") continue;
    if (entry.pattern.test(clauseText)) {
      targetLevel = DIRECTNESS_LEVEL_BY_SUBCATEGORY[entry.subcategory];
      break;
    }
  }
  if (targetLevel === undefined) return null;

  let best: DirectnessMatch | null = null;
  for (const entry of DIRECTNESS) {
    if (typeof entry.pattern === "string") continue;
    if (DIRECTNESS_LEVEL_BY_SUBCATEGORY[entry.subcategory] !== targetLevel) continue;
    const match = entry.pattern.exec(clauseText);
    if (!match) continue;
    const span: Span = { start: match.index, end: match.index + match[0].length };
    if (best === null || span.start < best.span.start) {
      best = { entry, span };
    }
  }
  return best;
}

/**
 * True when the span at `[span.start, span.end)` in `clauseText` sits
 * inside an open quotation (straight `"..."` or curly `“…”`) at both its
 * start and end — i.e. it was opened before the match and had not yet
 * closed by the match's end. Implements the SPEC.md §6.1 "apparent request
 * is inside quoted/reported text" guard the one way it is reproducible
 * from clause text alone: track quote-nesting state by a single left-to-
 * right scan rather than guessing from proximity, so an unrelated quoted
 * phrase earlier in the same clause (whose closing quote reads as
 * "the last quote before the match") cannot produce a false positive.
 */
function isQuotedSpan(clauseText: string, span: Span): boolean {
  let straightOpen = false;
  let curlyDepth = 0;
  let openAtStart = false;

  for (let i = 0; i < clauseText.length && i <= span.end; i++) {
    if (i === span.start) openAtStart = straightOpen || curlyDepth > 0;
    const ch = clauseText[i];
    if (ch === '"') straightOpen = !straightOpen;
    else if (ch === "“") curlyDepth += 1;
    else if (ch === "”") curlyDepth = Math.max(0, curlyDepth - 1);
  }
  const openAtEnd = straightOpen || curlyDepth > 0;

  return openAtStart && openAtEnd;
}

export function identifyHeadAct(text: string, sentences: Span[]): HeadAct | null {
  let best: { level: number; entry: LexEntry; sentenceSpan: Span; absMatchStart: number } | null = null;

  for (const sentenceSpan of sentences) {
    const clauseText = text.slice(sentenceSpan.start, sentenceSpan.end);
    const match = matchDirectness(clauseText);
    if (!match) continue;

    const level = DIRECTNESS_LEVEL_BY_SUBCATEGORY[match.entry.subcategory];
    if (level === undefined || level > MAX_REPRODUCIBLE_LEVEL) continue;
    if (isQuotedSpan(clauseText, match.span)) continue;

    const absMatchStart = sentenceSpan.start + match.span.start;
    if (best === null || level < best.level || (level === best.level && absMatchStart < best.absMatchStart)) {
      best = { level, entry: match.entry, sentenceSpan, absMatchStart };
    }
  }

  if (best === null) return null;

  return {
    span: best.sentenceSpan,
    ccsarpLevel: best.level,
    strategyName: best.entry.subcategory,
    // Non-scoring metadata only (Task 4): no reproducible general-purpose
    // verb/object parse exists in this pipeline. Left empty rather than
    // guessing — strategy detection and surface scoring never read these.
    verb: "",
    object: "",
  };
}
