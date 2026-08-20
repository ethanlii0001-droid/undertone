/**
 * Tests for identifyHeadAct (src/headAct.ts). Real CCSARP matching is
 * blocked on lexicons/directness.ts, which has zero patterns implemented
 * yet (see headAct.ts's file doc comment and CLAUDE.md "Known gaps" #4) —
 * so this only asserts the current stub's safe-suppress behavior. The
 * canonical SPEC.md §6 requirements remain `it.todo` until the real
 * CCSARP lexicon exists; they must not be asserted against a heuristic
 * stand-in.
 */
import { describe, it, expect } from "vitest";
import { segmentSentences } from "../src/segment.js";
import { identifyHeadAct } from "../src/headAct.js";

function headActOf(text: string) {
  return identifyHeadAct(text, segmentSentences(text));
}

describe("identifyHeadAct", () => {
  it("returns null (detection not yet implemented, pending lexicons/directness.ts)", () => {
    expect(headActOf("Could you review the deck before Thursday's client call?")).toBeNull();
  });

  it("returns null for an empty message", () => {
    expect(headActOf("")).toBeNull();
  });

  it.todo("matches clauses against the LEXICON.md §1 CCSARP inventory, most-direct-first with earliest-span tiebreak (SPEC.md §6), once lexicons/directness.ts exists");
  it.todo("achieves >= 0.90 precision/recall against fixture annotations once lexicons/directness.ts exists (SPEC.md §15.3 assertion #12)");
  it.todo("applies the SPEC.md §6.1 suppression guards (information-seeking, quoted text, verbless fragments, unresolved addressee)");
  it.todo("applies the SPEC.md §6.2 hint gates");
});
