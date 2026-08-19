/**
 * Assertion helper that checks a candidate user-facing string against the
 * banned phrase list in banned.ts and fails if it makes or implies a claim
 * about a sender's intent, per SPEC.md §13.1 and CLAUDE.md rule 5. Intended
 * for use both in UI copy tests and when assembling generated text (e.g.
 * the gap-report template in SPEC.md §13.1).
 */
