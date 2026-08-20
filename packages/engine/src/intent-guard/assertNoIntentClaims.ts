/**
 * Assertion helper that checks a candidate user-facing string against the
 * banned phrase list in banned.ts and fails if it makes or implies a claim
 * about a sender's intent, per SPEC.md §13.1 and CLAUDE.md rule 5. Intended
 * for use both in UI copy tests and when assembling generated text (e.g.
 * the gap-report template in SPEC.md §13.1).
 *
 * Scope: this checks GENERATED analysis text UnderTone produces about a
 * message — never the raw input `Message.text` a sender wrote. Nothing in
 * this module inspects or rejects input messages.
 */
import { BANNED_INTENT_PATTERNS, findReaderEffectViolation, type BannedIntentPattern } from "./banned.js";

/**
 * Returns the first banned intent-claiming construction found in `text`,
 * or `null` if none match. Checks the sender-intent pattern table first,
 * then the separate reader-effect-modalization surface (SPEC.md §13.1;
 * Prompt 7 Final Cleanup Task 3) — two distinct violation mechanisms
 * exposed through this one lookup function, which remains the single
 * non-throwing check `assertNoIntentClaims` below is built on. Pure — no
 * throw — so callers that want a non-throwing check (e.g. a test asserting
 * a SAFE string passes) can use this directly instead of catching
 * `assertNoIntentClaims`'s Error.
 */
export function findIntentClaim(text: string): BannedIntentPattern | null {
  for (const candidate of BANNED_INTENT_PATTERNS) {
    if (candidate.pattern.test(text)) return candidate;
  }
  return findReaderEffectViolation(text);
}

/**
 * Throws if `text` — a piece of UnderTone-GENERATED user-facing analysis
 * copy, never a raw input message — contains a banned sender-intent claim
 * (SPEC.md §13.1: no claim about what a sender meant, intended, really
 * wanted, knew, believed, or was trying to do) OR an unmodalized
 * reader-effect claim (SPEC.md §13.1: reader-effect statements must use
 * `likely to`/`tends to`/`at risk of`). Passes silently otherwise,
 * including for modalized reader-effect language ("a reader is likely
 * to...", "tends to...", "at risk of...") and statements about the
 * message/request/wording/phrasing/surrounding language, which SPEC.md
 * §13.1 permits.
 */
export function assertNoIntentClaims(text: string): void {
  const violation = findIntentClaim(text);
  if (violation) {
    throw new Error(`assertNoIntentClaims: generated text contains a banned intent/reader-effect claim (${violation.description}): ${JSON.stringify(text)}`);
  }
}
