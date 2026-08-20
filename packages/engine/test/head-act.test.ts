/**
 * Tests for identifyHeadAct (src/headAct.ts) against messy real-world
 * inputs. Covers the current provisional heuristic ladder (imperative,
 * ability-question, want-statement, suggestory), null-on-no-directive, the
 * most-direct-wins-with-earliest-tiebreak rule across multiple sentences,
 * and robustness against inline emoji / <@U012ABC> mention syntax.
 *
 * NOT yet covered (blocked on lexicons/directness.ts, which has zero
 * patterns implemented — see headAct.ts's file doc comment): full
 * precision/recall against fixture annotations (SPEC.md §15.3 assertion
 * #12) and the SPEC.md §6.1 suppression guards / §6.2 hint gates. Those
 * remain `it.todo` until the real CCSARP lexicon exists.
 */
import { describe, it, expect } from "vitest";
import { segmentSentences } from "../src/segment.js";
import { identifyHeadAct } from "../src/headAct.js";

function headActOf(text: string) {
  return identifyHeadAct(text, segmentSentences(text));
}

describe("identifyHeadAct", () => {
  it("detects a bare imperative", () => {
    const text = "Review the deck before Thursday's client call.";
    const headAct = headActOf(text);
    expect(headAct?.strategyName).toBe("imperative");
    expect(headAct?.ccsarpLevel).toBe(1);
    expect(headAct?.verb).toBe("review");
    expect(headAct?.object).toBe("the deck before Thursday's client call");
  });

  it("strips a leading Please from an imperative", () => {
    const headAct = headActOf("Please send the report over.");
    expect(headAct?.strategyName).toBe("imperative");
    expect(headAct?.verb).toBe("send");
    expect(headAct?.object).toBe("the report over");
  });

  it("detects a Could you ability question", () => {
    const headAct = headActOf("Could you review the deck before Thursday's client call?");
    expect(headAct?.strategyName).toBe("ability_question");
    expect(headAct?.ccsarpLevel).toBe(5);
    expect(headAct?.verb).toBe("review");
  });

  it("detects a Can/Would/Will you variant", () => {
    expect(headActOf("Can you send the update?")?.verb).toBe("send");
    expect(headActOf("Would you confirm the numbers?")?.verb).toBe("confirm");
    expect(headActOf("Will you check on this?")?.verb).toBe("check");
  });

  it("detects an explicit want statement", () => {
    const headAct = headActOf("I need you to submit the report by Friday.");
    expect(headAct?.strategyName).toBe("want_statement");
    expect(headAct?.ccsarpLevel).toBe(4);
    expect(headAct?.verb).toBe("submit");
  });

  it("detects a suggestory Let's form", () => {
    const headAct = headActOf("Let's review the deck together.");
    expect(headAct?.strategyName).toBe("suggestory");
    expect(headAct?.ccsarpLevel).toBe(6);
    expect(headAct?.verb).toBe("review");
  });

  it("returns null for a message with no directive", () => {
    expect(headActOf("Thanks so much for your help.")).toBeNull();
  });

  it("returns null for a genuine information-seeking question", () => {
    expect(headActOf("Do you know if the deck is ready?")).toBeNull();
  });

  it("returns null for an empty message", () => {
    expect(headActOf("")).toBeNull();
  });

  it("picks the most direct match across multiple sentences", () => {
    const text = "Thanks for the update. Review the deck before Thursday.";
    const headAct = headActOf(text);
    expect(headAct?.strategyName).toBe("imperative");
    expect(headAct?.verb).toBe("review");
  });

  it("picks the earliest match on a tie in directness", () => {
    const text = "Could you review the deck? Could you also send the invoice?";
    const headAct = headActOf(text);
    expect(headAct?.verb).toBe("review");
    expect(headAct?.span.start).toBe(0);
  });

  it("finds the request past a leading <@U012ABC> mention", () => {
    const headAct = headActOf("Hey <@U012ABC>, could you take a look at this?");
    expect(headAct?.strategyName).toBe("ability_question");
    expect(headAct?.verb).toBe("take");
  });

  it("finds the request past leading emoji and thanks", () => {
    const headAct = headActOf("Thanks 🙏 could you also send the file?");
    expect(headAct?.strategyName).toBe("ability_question");
    expect(headAct?.verb).toBe("send");
  });

  it("returned span indexes exactly into the original text", () => {
    const text = "Thanks for the update. Review the deck before Thursday.";
    const headAct = headActOf(text);
    expect(headAct).not.toBeNull();
    if (headAct) {
      expect(text.slice(headAct.span.start, headAct.span.end)).toContain("Review the deck");
    }
  });

  it.todo("achieves >= 0.90 precision/recall against fixture annotations once lexicons/directness.ts exists (SPEC.md §15.3 assertion #12)");
  it.todo("applies the SPEC.md §6.1 suppression guards (information-seeking, quoted text, verbless fragments, unresolved addressee)");
  it.todo("applies the SPEC.md §6.2 hint gates");
});
