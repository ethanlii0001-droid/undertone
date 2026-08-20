/**
 * Tests for identifyHeadAct (src/headAct.ts) now that lexicons/directness.ts
 * carries the real LEXICON.md §1 CCSARP inventory (Prompt 5). Covers
 * reproducible L1–L7 matching, the canonical collision rulings (`I need you
 * to`, `you should`, `let's`, `make sure to`), most-direct-wins /
 * earliest-span tiebreak, and the reproducible quote guard (SPEC.md §6.1).
 *
 * L8/L9 (hints) and the addressee-resolution / verbless-fragment guards
 * need Thread/prior-message context that identifyHeadAct's current
 * (text, sentences) signature does not receive — those stay `it.todo`
 * rather than firing unconditionally or being faked (see headAct.ts's file
 * doc comment and CLAUDE.md "Known gaps" #4).
 */
import { describe, it, expect } from "vitest";
import { segmentSentences } from "../src/segment.js";
import { identifyHeadAct } from "../src/headAct.js";

function headActOf(text: string) {
  return identifyHeadAct(text, segmentSentences(text));
}

describe("identifyHeadAct", () => {
  it("detects L1 mood-derivable (imperative)", () => {
    const headAct = headActOf("Review the deck before Thursday's client call.");
    expect(headAct?.strategyName).toBe("mood_derivable");
    expect(headAct?.ccsarpLevel).toBe(1);
  });

  it("detects L2 explicit performative", () => {
    const headAct = headActOf("I'm asking you to review the deck.");
    expect(headAct?.strategyName).toBe("performative");
    expect(headAct?.ccsarpLevel).toBe(2);
  });

  it("detects L3 hedged performative", () => {
    const headAct = headActOf("I'd like to ask you to review the deck.");
    expect(headAct?.strategyName).toBe("hedged_performative");
    expect(headAct?.ccsarpLevel).toBe(3);
  });

  it("detects L4 obligation", () => {
    const headAct = headActOf("You need to review the deck.");
    expect(headAct?.strategyName).toBe("obligation");
    expect(headAct?.ccsarpLevel).toBe(4);
  });

  it("detects L5 want statement", () => {
    const headAct = headActOf("I want the deck reviewed.");
    expect(headAct?.strategyName).toBe("want");
    expect(headAct?.ccsarpLevel).toBe(5);
  });

  it("detects L6 suggestory formula", () => {
    const headAct = headActOf("How about we review the deck?");
    expect(headAct?.strategyName).toBe("suggestory");
    expect(headAct?.ccsarpLevel).toBe(6);
  });

  it("detects L7 query preparatory", () => {
    const headAct = headActOf("Could you review the deck before Thursday's client call?");
    expect(headAct?.strategyName).toBe("query_preparatory");
    expect(headAct?.ccsarpLevel).toBe(7);
  });

  it("resolves 'I need you to' as L4 obligation, not L5 want (LEXICON.md §0.3)", () => {
    const headAct = headActOf("I need you to submit the report by Friday.");
    expect(headAct?.strategyName).toBe("obligation");
    expect(headAct?.ccsarpLevel).toBe(4);
  });

  it("resolves 'let's' as L6 suggestory, not L1 imperative (LEXICON.md §0.3)", () => {
    const headAct = headActOf("Let's review the deck together.");
    expect(headAct?.strategyName).toBe("suggestory");
    expect(headAct?.ccsarpLevel).toBe(6);
  });

  it("resolves 'make sure to' as L1 mood derivable (LEXICON.md §0.3)", () => {
    const headAct = headActOf("Make sure to review the deck before Thursday.");
    expect(headAct?.strategyName).toBe("mood_derivable");
    expect(headAct?.ccsarpLevel).toBe(1);
  });

  it("resolves 'you should' as L4 obligation (LEXICON.md §0.3)", () => {
    const headAct = headActOf("You should review the deck before Thursday.");
    expect(headAct?.strategyName).toBe("obligation");
    expect(headAct?.ccsarpLevel).toBe(4);
  });

  it("returns null for a message with no reproducible strategy match", () => {
    expect(headActOf("Thanks so much for your help.")).toBeNull();
  });

  it("returns null for a genuine information-seeking question (SPEC.md §6.1)", () => {
    expect(headActOf("Do you know if the deck's supposed to be ready before Thursday, or is that not until next week?")).toBeNull();
  });

  it("returns null for an empty message", () => {
    expect(headActOf("")).toBeNull();
  });

  it("picks the most direct match across multiple sentences", () => {
    const text = "Could you take a look when you can? Review the deck before Thursday.";
    const headAct = headActOf(text);
    expect(headAct?.strategyName).toBe("mood_derivable");
  });

  it("picks the earliest span on a same-level tie", () => {
    const text = "Could you review the deck? Could you also send the invoice?";
    const headAct = headActOf(text);
    expect(headAct?.strategyName).toBe("query_preparatory");
    expect(headAct?.span.start).toBe(0);
  });

  it("picks the earliest same-level match WITHIN one clause, not the first-listed pattern that happens to fire later in the text (Prompt 5 reconciliation)", () => {
    // Both "can you" and "could you" are L7 query_preparatory, but "can you" is listed
    // before "could you" in LEXICON.md §1's array. The winning span must still be the
    // earlier "Could you" occurring in the text, not the later "can you".
    const text = "Could you review this, and can you send that?";
    const headAct = headActOf(text);
    expect(headAct?.strategyName).toBe("query_preparatory");
    expect(headAct?.span.start).toBe(0);
    expect(text.slice(0, 9)).toBe("Could you");
  });

  it("returned span indexes exactly into the original text", () => {
    const text = "Thanks for the update. Review the deck before Thursday.";
    const headAct = headActOf(text);
    expect(headAct).not.toBeNull();
    if (headAct) {
      expect(text.slice(headAct.span.start, headAct.span.end)).toContain("Review the deck");
    }
  });

  it("does not score a request quoted/reported inside another speaker's utterance (SPEC.md §6.1, EVAL.md hc-09)", () => {
    const text = "Alex wrote, “Could you send the figures by Friday?” I think that request is outdated.";
    expect(headActOf(text)).toBeNull();
  });

  it.todo("fires L8 strong hints only when the request object/precondition is reproducibly recoverable (SPEC.md §6.2) — needs context this function's signature does not receive");
  it.todo("fires L9 mild hints only with a prior same-sender request meeting the requestSignature overlap gate (SPEC.md §6.2, §11.4) — needs Thread context");
  it.todo("applies the unresolved-addressee suppression guard (SPEC.md §6.1) — needs Message.recipientIds, not received by this function's signature");
  it.todo("achieves >= 0.90 precision/recall against fixture annotations (SPEC.md §15.3 assertion #12) — no fixture set exists yet that scores precision/recall directly; EVAL.md's minimal pairs test direction/invariance, not classification accuracy against per-example ground-truth labels");
});
