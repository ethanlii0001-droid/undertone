/**
 * Identifies whether a message contains a reproducible request and locates
 * its head act — the minimal clause that realizes the request (see
 * CLAUDE.md glossary: "Head act"). Per SPEC.md §6, the detector must match
 * clauses against the CCSARP strategy inventory in LEXICON.md §1 and take
 * the most-direct matching strategy, ties going to the earliest span; it
 * must also apply the SPEC.md §6.1 suppression guards and §6.2 hint gates.
 *
 * BLOCKED: `lexicons/directness.ts` has zero patterns implemented yet — the
 * full nine-level CCSARP inventory is specified in LEXICON.md §1 but hasn't
 * been ported into code. Per CLAUDE.md's test-first rule, this must not be
 * filled in with a hard-coded, competing strategy inventory as a stand-in
 * (see CLAUDE.md "Known gaps" #4). Until `lexicons/directness.ts` exists,
 * this returns `null` unconditionally, which is the safe direction per
 * CLAUDE.md rule 4 (suppress rather than guess) — read it as "detection is
 * not yet implemented," not as "no request was found." The corresponding
 * SPEC.md requirements (fixture precision/recall, suppression guards, hint
 * gates) are tracked as `it.todo` in head-act.test.ts rather than asserted
 * against a heuristic stand-in.
 *
 * Signature note: the request as literally specified,
 * `identifyHeadAct(sentences: Span[]): HeadAct | null`, is unusable —
 * spans without the string they index into carry no content to classify.
 * This takes `text` as well, matching how every other span-producing
 * function in this codebase is actually called (e.g.
 * `identifyHeadAct(text, segmentSentences(text))`).
 */
import type { HeadAct, Span } from "./types.js";

export function identifyHeadAct(text: string, sentences: Span[]): HeadAct | null {
  return null;
}
