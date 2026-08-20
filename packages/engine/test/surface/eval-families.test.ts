/**
 * Fixture-driven surface test (Prompt 5 Task 8G, reconciled in Prompt 5
 * Reconciliation Task 1) against EVAL.md's three surface-manipulation
 * families (SPEC.md §15.1): `head-act-modality`, `head-act-strategy`,
 * `internal-modification` — 20 pairs each, force-bearing context held
 * fixed while surface realization varies. Loads the mechanically-extracted
 * fixtures (test/fixtures/core-pairs.ts) and asserts each pair's OWN
 * `expected.surfaceRelation` / `expected.minSurfaceDelta` — never a single
 * hardcoded global threshold. Force is not computed or asserted here
 * (mask.ts/force scoring are out of scope for this pass).
 *
 * Built directly on identifyHeadAct + scoreSurface, not the still-
 * unimplemented public score().
 *
 * All 60 pairs (120 variants) are now detected and asserted — zero skips.
 * The previous version of this file skipped 9 pairs whose "a" variant used
 * an L1 imperative verb absent from LEXICON.md §1's `mood_derivable` list
 * (`submit`, `swap`, `proofread`, `return`, `schedule`) or an "I'd like
 * you to..." L5 want-statement the old, malformed `I (would |'?d )?like`
 * regex couldn't match (no space between `I` and the contracted `'d`).
 * Both were genuine LEXICON.md defects, not fixture problems, and have
 * been corrected in LEXICON.md itself (narrow reconciliation — the five
 * verbs were added to their most linguistically appropriate existing L1
 * alternation, and the L5 regex was restructured so the whitespace
 * requirement no longer assumes an uncontracted "would"/full space before
 * the optional modal); packages/engine/src/lexicons/directness.ts was then
 * re-synchronized to match byte-for-byte.
 */
import { describe, it, expect } from "vitest";
import { segmentSentences } from "../../src/segment.js";
import { identifyHeadAct } from "../../src/headAct.js";
import { scoreSurface } from "../../src/surface/score.js";
import type { Message } from "../../src/types.js";
import { SURFACE_MANIPULATION_FAMILIES, pairsByFamily, type ExpectedSurfaceManipulation } from "../fixtures/core-pairs.js";

function buildMessage(id: string, text: string): Message {
  return {
    id,
    threadId: id,
    senderId: "a@example.com",
    recipientIds: ["b@example.com"],
    mentionedIds: [],
    timestamp: "2026-08-17T09:00:00-04:00",
    text,
  };
}

function surfaceOf(id: string, text: string): number {
  const message = buildMessage(id, text);
  const headAct = identifyHeadAct(text, segmentSentences(text));
  if (!headAct) throw new Error(`no head act detected for ${id}: ${JSON.stringify(text)}`);
  return scoreSurface(message, headAct).value;
}

describe("fixture integrity: all 60 surface-manipulation pairs are string variants", () => {
  it("every head-act-modality/head-act-strategy/internal-modification pair has string 'a' and 'b' variants (no TestThread here)", () => {
    let count = 0;
    for (const family of SURFACE_MANIPULATION_FAMILIES) {
      for (const pair of pairsByFamily(family)) {
        expect(typeof pair.a, `${pair.id}.a`).toBe("string");
        expect(typeof pair.b, `${pair.id}.b`).toBe("string");
        count += 1;
      }
    }
    expect(count).toBe(60);
  });
});

for (const family of SURFACE_MANIPULATION_FAMILIES) {
  describe(`surface EVAL family: ${family}`, () => {
    for (const pair of pairsByFamily(family)) {
      const expected = pair.expected as ExpectedSurfaceManipulation;
      const a = pair.a as string;
      const b = pair.b as string;

      it(`${pair.id}: ${expected.claim}`, () => {
        const surfaceA = surfaceOf(`${pair.id}-a`, a);
        const surfaceB = surfaceOf(`${pair.id}-b`, b);
        const delta = surfaceA - surfaceB;

        if (expected.surfaceRelation === "a > b") {
          expect(delta, `${pair.id}: surface(a) - surface(b) >= ${expected.minSurfaceDelta}`).toBeGreaterThanOrEqual(
            expected.minSurfaceDelta,
          );
        } else {
          expect(-delta, `${pair.id}: surface(b) - surface(a) >= ${expected.minSurfaceDelta}`).toBeGreaterThanOrEqual(
            expected.minSurfaceDelta,
          );
        }
      });
    }
  });
}
