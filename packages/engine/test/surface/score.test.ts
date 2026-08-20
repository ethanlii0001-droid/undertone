/**
 * Tests for scoreSurface (src/surface/score.ts) against SPEC.md §7's exact
 * formula, LEXICON.md §0.2's absorption rule, LEXICON.md §0.3's collision
 * rulings, and SPEC.md §7.2's attachment scoping. Built directly on
 * identifyHeadAct + scoreSurface (not the still-unimplemented public
 * score()), since Prompt 5 implements the surface half only.
 */
import { describe, it, expect } from "vitest";
import { segmentSentences } from "../../src/segment.js";
import { identifyHeadAct } from "../../src/headAct.js";
import { scoreSurface } from "../../src/surface/score.js";
import type { Message } from "../../src/types.js";

let nextId = 0;
function buildMessage(text: string): Message {
  nextId += 1;
  return {
    id: `m${nextId}`,
    threadId: "t1",
    senderId: "a@example.com",
    recipientIds: ["b@example.com"],
    mentionedIds: [],
    timestamp: "2026-08-17T09:00:00-04:00",
    text,
  };
}

/** Scores `text` end-to-end through the real detector, failing loudly (not silently skipping) if no head act is found — every fixture here is expected to be detected. */
function scoreText(text: string) {
  const message = buildMessage(text);
  const headAct = identifyHeadAct(text, segmentSentences(text));
  if (!headAct) throw new Error(`test fixture expected a detected request: ${JSON.stringify(text)}`);
  return { message, headAct, result: scoreSurface(message, headAct) };
}

describe("scoreSurface: formula (SPEC.md §7)", () => {
  it("a bare strategy receives its canonical base with no modifier evidence", () => {
    const { result } = scoreText("Review the deck.");
    expect(result.value).toBeCloseTo(10.0, 9);
    expect(result.ccsarpLevel).toBe(1);
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0]?.category).toBe("directness");
  });

  it("a simple downgrader applies raw * -0.40", () => {
    // L4 obligation base, no trailing "?" so the interrogative downgrader doesn't confound the arithmetic.
    const { result } = scoreText("You need to maybe review the deck.");
    // base 7.0 (obligation) + (1.2 * -0.40 for "maybe")
    expect(result.value).toBeCloseTo(7.0 - 0.48, 9);
    const maybeEvidence = result.evidence.find((e) => e.subcategory === "downtoner" && e.trigger.toLowerCase() === "maybe");
    expect(maybeEvidence?.rawWeight).toBe(1.2);
    expect(maybeEvidence?.weight).toBeCloseTo(-0.48, 9);
  });

  it("a simple upgrader applies raw * +0.40", () => {
    const { result } = scoreText("You need to urgently review the deck.");
    // base 7.0 + (2.0 * 0.40 for "urgently")
    expect(result.value).toBeCloseTo(7.0 + 0.8, 9);
    const urgentEvidence = result.evidence.find((e) => e.subcategory === "lexical_uptoner");
    expect(urgentEvidence?.rawWeight).toBe(2.0);
    expect(urgentEvidence?.weight).toBeCloseTo(0.8, 9);
  });

  it("downgrade and upgrade combine algebraically", () => {
    const { result } = scoreText("You need to maybe urgently review the deck.");
    // base 7.0 + (-0.48 + 0.8)
    expect(result.value).toBeCloseTo(7.0 - 0.48 + 0.8, 9);
  });

  it("the global modifier clamp is exactly [-3, +3] on the downgrade side", () => {
    const { result } = scoreText(
      "Could you, I don't suppose, if that's not too much hassle, totally up to you, your call, no rush, no pressure, review the deck?",
    );
    const directness = result.evidence.find((e) => e.category === "directness");
    const modifierSum = result.evidence.filter((e) => e.category !== "directness").reduce((s, e) => s + e.weight, 0);
    expect(directness?.rawWeight).toBe(3.5);
    expect(modifierSum).toBeCloseTo(-3.0, 9);
    expect(result.value).toBeCloseTo(3.5 - 3.0, 9);
  });

  it("the global modifier clamp is exactly [-3, +3] on the upgrade side, and clamps the raw aggregate rather than truncating per-category (no hidden per-subcategory cap)", () => {
    // Note: with the L7 "could you" -> separately-scored "could" reconciliation (LEXICON.md §0.3),
    // plus the trailing "?" interrogative downgrader, this fixture needs enough real upgrader
    // matches to still clear +3 after those two -0.4 pulls. ("critically"/"essentially" deliberately
    // don't match — LEXICON's "critical"/"essential" patterns have no "-ly" alternation — so they're
    // left out rather than padding the count with dead words.)
    const { result } = scoreText(
      "Could you absolutely definitely obviously clearly urgently seriously really very review the deck?",
    );
    const directness = result.evidence.find((e) => e.category === "directness");
    const modifierEvidence = result.evidence.filter((e) => e.category !== "directness");
    const modifierSum = modifierEvidence.reduce((s, e) => s + e.weight, 0);
    const rawSum = modifierEvidence.reduce((s, e) => s + e.rawWeight * 0.4, 0);
    expect(directness?.rawWeight).toBe(3.5);
    // Every individual upgrader survives as its own Evidence entry (rawWeight preserved) —
    // proof the aggregate clamp did not zero out or drop entries category-by-category.
    expect(modifierEvidence.length).toBeGreaterThan(3);
    expect(rawSum).toBeGreaterThan(3.0); // uncapped aggregate genuinely exceeds the clamp
    expect(modifierSum).toBeCloseTo(3.0, 9); // but the emitted contributions still sum to the clamped delta
    expect(result.value).toBeCloseTo(6.5, 9); // 3.5 + 3.0, clamp bites before hitting 10
    for (const e of modifierEvidence) expect(e.capped).toBe(true);
  });

  it("final surface clamps to [0, 10] even when the uncapped modifier delta would push past the ceiling", () => {
    const { result } = scoreText("Review the deck absolutely.");
    // base 10.0 (mood_derivable) + upgrader "absolutely" (1.6 * 0.4 = 0.64) would be 10.64
    expect(result.value).toBeCloseTo(10, 9);
    const upgraderEvidence = result.evidence.find((e) => e.category === "upgrader");
    expect(upgraderEvidence?.rawWeight).toBe(1.6);
    // Rescaled to 0 by the [0,10] ceiling bookkeeping (Task 7): effectiveModifierDelta is 0 here.
    expect(upgraderEvidence?.weight).toBeCloseTo(0, 9);
    expect(upgraderEvidence?.capped).toBe(true);
  });

  it("there is no exponential/diminishing-returns formula: two independent downgraders sum linearly below the clamp", () => {
    const { result } = scoreText("You need to maybe possibly review the deck.");
    // base 7.0 + (1.2*-0.4) + (1.0*-0.4) = 7.0 - 0.48 - 0.40
    expect(result.value).toBeCloseTo(7.0 - 0.48 - 0.4, 9);
  });
});

describe("scoreSurface: absorption (LEXICON.md §0.2, reconciled)", () => {
  it("the default rule still absorbs a genuinely constitutive modifier not on the exception list ('please' inside an L1 imperative)", () => {
    const { result } = scoreText("Please send the report.");
    expect(result.value).toBeCloseTo(10.0, 9);
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence.some((e) => e.subcategory === "politeness_marker")).toBe(false);
  });

  it("'Could you ...' separately scores its conditional 'could' — LEXICON.md §1's own note on that entry, not absorbed", () => {
    const { result } = scoreText("Could you review the deck?");
    // base 3.5 (query_preparatory) - 0.4 ("could", now an explicit §0.2 exception per its own note) - 0.4 (trailing "?" interrogative, always separate).
    expect(result.value).toBeCloseTo(3.5 - 0.4 - 0.4, 9);
    expect(result.evidence).toHaveLength(3);
    const could = result.evidence.find((e) => e.subcategory === "syntactic.conditional");
    expect(could?.rawWeight).toBe(1.0);
    expect(could?.weight).toBeCloseTo(-0.4, 9);
    expect(result.evidence.some((e) => e.subcategory === "syntactic.interrogative")).toBe(true);
  });

  it("'Maybe we could ...' separately scores 'maybe' (per its note) but keeps the constitutive modal 'could' absorbed (no note claims it)", () => {
    const { result } = scoreText("Maybe we could review the deck.");
    // base 4.5 (suggestory) - 0.48 ("maybe", exempted) — "could" stays absorbed: no trailing "?" here either.
    expect(result.value).toBeCloseTo(4.5 - 0.48, 9);
    expect(result.evidence).toHaveLength(2);
    expect(result.evidence.some((e) => e.subcategory === "downtoner")).toBe(true);
    expect(result.evidence.some((e) => e.subcategory === "syntactic.conditional")).toBe(false);
  });

  it("'Do you think you could ...' separately scores both indirection layers — LEXICON.md §1's own note: 'two layers of indirection, both separately downgraded'", () => {
    const { result } = scoreText("Do you think you could review the deck?");
    // base 3.5 (query_preparatory) - 0.56 ("do you think", consultative) - 0.4 ("could") - 0.4 (trailing "?").
    expect(result.value).toBeCloseTo(3.5 - 0.56 - 0.4 - 0.4, 9);
    expect(result.evidence).toHaveLength(4);
    expect(result.evidence.some((e) => e.subcategory === "consultative")).toBe(true);
    expect(result.evidence.some((e) => e.subcategory === "syntactic.conditional")).toBe(true);
  });

  it("'you should' still receives its explicit weak-deontic companion downgrade (LEXICON.md §0.3 exception)", () => {
    const { result } = scoreText("You should review the deck.");
    const directness = result.evidence.find((e) => e.category === "directness");
    const weakDeontic = result.evidence.find((e) => e.subcategory === "syntactic.weak_deontic");
    expect(directness?.subcategory).toBe("obligation");
    expect(directness?.rawWeight).toBe(7.0);
    expect(weakDeontic).toBeDefined();
    expect(weakDeontic?.rawWeight).toBe(0.8);
    expect(weakDeontic?.weight).toBeCloseTo(-0.32, 9);
    expect(result.value).toBeCloseTo(7.0 - 0.32, 9);
  });
});

describe("scoreSurface: collision rulings (LEXICON.md §0.3)", () => {
  it("'no rush' is a surface downgrader", () => {
    const { result } = scoreText("Could you review the deck? No rush.");
    expect(result.evidence.some((e) => e.subcategory === "workplace_formula" && /no rush/i.test(e.trigger))).toBe(true);
  });

  it("'urgent' is a surface upgrader", () => {
    const { result } = scoreText("Could you urgently review the deck?");
    expect(result.evidence.some((e) => e.category === "upgrader" && e.subcategory === "lexical_uptoner")).toBe(true);
  });

  it("'ASAP' is NOT a surface upgrader in its actual canonical (all-caps) form — the orthography-only emphatic-caps rule must not smuggle back a §0.3-excluded, temporal-only word", () => {
    const { result } = scoreText("Could you send this ASAP?");
    expect(result.evidence.some((e) => e.trigger.toUpperCase() === "ASAP")).toBe(false);
    expect(result.evidence.some((e) => e.category === "upgrader")).toBe(false);
  });

  it("'BLOCKED' is NOT a surface upgrader in its actual canonical (all-caps) form — same leak, dependency-only word", () => {
    const { result } = scoreText("Could you fix this? BLOCKED on another task.");
    expect(result.evidence.some((e) => e.trigger.toUpperCase() === "BLOCKED")).toBe(false);
    expect(result.evidence.some((e) => e.category === "upgrader")).toBe(false);
  });

  it("'RIGHT AWAY' is NOT a surface upgrader — the all-caps rule must not collide via 'RIGHT' alone (LEXICON.md §0.3, temporal-only)", () => {
    const { result } = scoreText("Could you send this RIGHT AWAY?");
    expect(result.evidence.some((e) => e.subcategory === "emphatic_orthography" && /right/i.test(e.trigger))).toBe(false);
    expect(result.evidence.some((e) => e.category === "upgrader")).toBe(false);
  });

  it("'FIRST THING' is NOT a surface upgrader — the all-caps rule must not collide via 'FIRST' alone (LEXICON.md §0.3, temporal-only)", () => {
    const { result } = scoreText("Could you send this FIRST THING tomorrow?");
    expect(result.evidence.some((e) => e.subcategory === "emphatic_orthography" && /first/i.test(e.trigger))).toBe(false);
    expect(result.evidence.some((e) => e.category === "upgrader")).toBe(false);
  });

  it("negative control: an unrelated legitimate all-caps word still triggers emphatic_orthography normally", () => {
    const { result } = scoreText("Could you send this TOMORROW?");
    const emphatic = result.evidence.find((e) => e.subcategory === "emphatic_orthography");
    expect(emphatic?.trigger).toBe("TOMORROW");
    expect(emphatic?.rawWeight).toBe(1.2);
  });

  it("blockage words are NOT surface upgraders in lowercase either (dependency/force-only per LEXICON.md §0.3)", () => {
    const { result } = scoreText("Could you review the deck? It is blocking three other tasks.");
    expect(result.evidence.some((e) => /block/i.test(e.trigger))).toBe(false);
  });

  it("a single '!' contributes nothing", () => {
    const { result } = scoreText("Review the deck!");
    expect(result.value).toBeCloseTo(10.0, 9);
    expect(result.evidence).toHaveLength(1);
  });

  it("repeated exclamation matches only the canonical entry", () => {
    const { result } = scoreText("Could you review the deck!!");
    const emphatic = result.evidence.find((e) => e.subcategory === "emphatic_orthography" && e.trigger === "!!");
    expect(emphatic?.rawWeight).toBe(1.6);
    // base 3.5 - 0.4 ("could", separately scored per LEXICON.md §0.3 reconciliation) + 1.6*0.4 ("!!").
    expect(result.value).toBeCloseTo(3.5 - 0.4 + 1.6 * 0.4, 9);
  });
});

describe("scoreSurface: attachment scoping (SPEC.md §7.2)", () => {
  it("a same-sentence softener attaches", () => {
    const { result } = scoreText("Could you just send this by 5?");
    expect(result.evidence.some((e) => e.subcategory === "downtoner" && /just/i.test(e.trigger))).toBe(true);
  });

  it("a standalone 'No rush.' immediately after the request attaches to it", () => {
    const { result } = scoreText("Could you send this by 5? No rush.");
    expect(result.value).toBeLessThan(3.5);
    expect(result.evidence.some((e) => e.subcategory === "workplace_formula")).toBe(true);
  });

  it("'No rush on the other task.' does not attach when it precedes the request", () => {
    const { result } = scoreText("No rush on the other task. Could you send this by 5?");
    // base 3.5 - 0.4 ("could", separately scored) - 0.4 (trailing "?" interrogative); the preceding sentence never enters either zone.
    expect(result.value).toBeCloseTo(3.5 - 0.4 - 0.4, 9);
    expect(result.evidence).toHaveLength(3);
    expect(result.evidence.some((e) => e.subcategory === "workplace_formula")).toBe(false);
  });

  it("'No rush on the other task.' does not attach when it follows the request either, because it is not a standalone formula", () => {
    const { result } = scoreText("Could you send this by 5? No rush on the other task.");
    expect(result.value).toBeCloseTo(3.5 - 0.4 - 0.4, 9);
    expect(result.evidence).toHaveLength(3);
    expect(result.evidence.some((e) => e.subcategory === "workplace_formula")).toBe(false);
  });

  it("'No rush on the other task, but could you send this by 5?' does not attach 'no rush' even though it is in the SAME sentence", () => {
    const { result } = scoreText("No rush on the other task, but could you send this by 5?");
    // base 3.5 - 0.4 ("could") - 0.4 (trailing "?"); "no rush" sits in its own local segment
    // ("No rush on the other task"), split off from the directness match's segment by the
    // contrastive "but", and that segment is not standalone modifier material — "on the
    // other task" survives removal of the "no rush" match.
    expect(result.value).toBeCloseTo(3.5 - 0.4 - 0.4, 9);
    expect(result.evidence).toHaveLength(3);
    expect(result.evidence.some((e) => e.subcategory === "workplace_formula")).toBe(false);
  });

  it("'No rush on payroll, but could you send this by 5?' does not attach 'no rush' — no marker word, just non-trivial leftover content in its segment", () => {
    const { result } = scoreText("No rush on payroll, but could you send this by 5?");
    expect(result.value).toBeCloseTo(3.5 - 0.4 - 0.4, 9);
    expect(result.evidence).toHaveLength(3);
    expect(result.evidence.some((e) => e.subcategory === "workplace_formula")).toBe(false);
  });

  it("'No rush regarding onboarding, but could you review the deck?' does not attach 'no rush' either", () => {
    const { result } = scoreText("No rush regarding onboarding, but could you review the deck?");
    // base 3.5 (query_preparatory, "could you") - 0.4 ("could") - 0.4 (trailing "?"). "review" is NOT
    // clause-initial here (L1 patterns are anchored to the start of the clause), so "could you" wins.
    expect(result.value).toBeCloseTo(3.5 - 0.4 - 0.4, 9);
    expect(result.evidence).toHaveLength(3);
    expect(result.evidence.some((e) => e.subcategory === "workplace_formula")).toBe(false);
  });

  it("'No rush, but could you send this by 5?' DOES attach — its own segment is standalone modifier material with only harmless coordination removed", () => {
    const { result } = scoreText("No rush, but could you send this by 5?");
    expect(result.evidence.some((e) => e.subcategory === "workplace_formula" && /no rush/i.test(e.trigger))).toBe(true);
  });

  it("a parenthetical, comma-set-off softener in the SAME sentence still attaches when its segment is standalone", () => {
    const { result } = scoreText("Could you, if you have a sec, send this by 5?");
    expect(result.evidence.some((e) => e.subcategory === "workplace_formula" && /if you have a sec/i.test(e.trigger))).toBe(
      true,
    );
  });

  it("a trailing 'no rush' after a comma (same sentence, no 'but') attaches", () => {
    const { result } = scoreText("Could you send this by 5, no rush?");
    expect(result.evidence.some((e) => e.subcategory === "workplace_formula" && /no rush/i.test(e.trigger))).toBe(true);
  });

  it("a trailing 'no rush on payroll' after a comma does NOT attach — non-trivial leftover in its own segment", () => {
    const { result } = scoreText("Could you send this by 5, no rush on payroll?");
    expect(result.evidence.some((e) => e.subcategory === "workplace_formula")).toBe(false);
  });
});

describe("scoreSurface: surface overlap dedup (LEXICON.md §0.4 rule 9, Prompt 5 reconciliation)", () => {
  it("'totally up to you' is counted once, not also as the nested 'up to you'", () => {
    const { result } = scoreText("Could you send this, totally up to you?");
    const consultative = result.evidence.filter((e) => e.subcategory === "consultative");
    expect(consultative).toHaveLength(1);
    expect(consultative[0]?.trigger).toBe("totally up to you");
    expect(consultative[0]?.rawWeight).toBe(3.0);
  });

  it("'by any chance' is counted once, not also as the nested 'any chance'", () => {
    const { result } = scoreText("By any chance could you also check the logs?");
    const downtoners = result.evidence.filter((e) => e.subcategory === "downtoner" && /chance/i.test(e.trigger));
    expect(downtoners).toHaveLength(1);
    expect(downtoners[0]?.trigger).toBe("By any chance");
    expect(downtoners[0]?.rawWeight).toBe(1.6);
  });

  it("'really really' is counted once, not also as the nested single 'really'", () => {
    const { result } = scoreText("Could you really really check this?");
    const intensifiers = result.evidence.filter((e) => e.category === "upgrader" && /really/i.test(e.trigger));
    expect(intensifiers).toHaveLength(1);
    expect(intensifiers[0]?.trigger).toBe("really really");
    expect(intensifiers[0]?.rawWeight).toBe(1.8);
  });

  it("'really important' is counted once, not also as the nested single 'really'", () => {
    const { result } = scoreText("Could you check this really important document?");
    const upgraders = result.evidence.filter((e) => e.category === "upgrader" && /really/i.test(e.trigger));
    expect(upgraders).toHaveLength(1);
    expect(upgraders[0]?.trigger).toBe("really important");
    expect(upgraders[0]?.rawWeight).toBe(1.6);
  });

  it("does not collapse genuinely separate, non-overlapping modifiers", () => {
    const { result } = scoreText("Could you just urgently review the deck?");
    expect(result.evidence.some((e) => e.subcategory === "downtoner" && e.trigger === "just")).toBe(true);
    expect(result.evidence.some((e) => e.subcategory === "lexical_uptoner" && e.trigger === "urgently")).toBe(true);
  });
});

describe("scoreSurface: span fidelity (SPEC.md §4, §10.2)", () => {
  const fixtures = [
    "Review the deck.",
    "Could you maybe urgently review the deck?",
    "You should review the deck.",
    "Could you send this by 5? No rush.",
    "Could you review the deck!!",
    "Do you think you could review the deck?",
    "Could you send this, totally up to you?",
    "No rush on the other task, but could you send this by 5?",
  ];

  for (const text of fixtures) {
    it(`every evidence.trigger matches message.text.slice(span) for: ${JSON.stringify(text)}`, () => {
      const { message, result } = scoreText(text);
      for (const e of result.evidence) {
        expect(e.trigger).toBe(message.text.slice(e.span.start, e.span.end));
        expect(e.scorer).toBe("surface");
        expect(e.messageId).toBe(message.id);
      }
    });
  }
});
