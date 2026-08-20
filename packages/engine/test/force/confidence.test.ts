/**
 * Tests for computeConfidence (src/force/confidence.ts) — the Prompt 7A v1
 * engineering rubric (SPEC.md §12: reliability of THIS rule-based analysis,
 * never sender certainty/intent/compliance likelihood). Mixes the full
 * test-only mini-pipeline (identifyHeadAct -> scoreSurface ->
 * buildMaskedMessage -> scoreForce -> computeConfidence, matching
 * test/force/score.test.ts's established pattern) for integration cases
 * with hand-built Evidence fixtures for cases that need precise control
 * over eventId/weight/span (dedup counting, partition overlap, clamping).
 */
import { describe, it, expect } from "vitest";
import { segmentSentences } from "../../src/segment.js";
import { identifyHeadAct } from "../../src/headAct.js";
import { scoreSurface } from "../../src/surface/score.js";
import { buildMaskedMessage } from "../../src/mask.js";
import { scoreForce } from "../../src/force/score.js";
import {
  computeConfidence,
  CONFIDENCE_BASE,
  CONFIDENCE_MAX,
  HEAD_ACT_EXACT_BONUS,
  RESOLVABLE_ADDRESSEE_BONUS,
  CLEAN_PARTITION_BONUS,
  ONE_FORCE_EVENT_BONUS,
  TWO_PLUS_FORCE_EVENTS_BONUS,
  UNRESOLVED_TEMPORAL_PENALTY,
  TEMPORAL_ASSUMPTION_PENALTY,
  PARTITION_OVERLAP_PENALTY,
} from "../../src/force/confidence.js";
import type { Config, Evidence, HeadAct, Message, Span } from "../../src/types.js";

// ---------------------------------------------------------------------------
// Full-pipeline fixture helper (mirrors test/force/score.test.ts).
// ---------------------------------------------------------------------------

let nextMessageId = 0;
function buildMessage(text: string, recipientIds: string[] = ["b@example.com"]): Message {
  nextMessageId += 1;
  return {
    id: `m${nextMessageId}`,
    threadId: "t1",
    senderId: "a@example.com",
    recipientIds,
    mentionedIds: [],
    timestamp: "2026-08-17T09:00:00-04:00",
    text,
  };
}

const CONFIG: Config = { businessDayEnd: "17:00" };

function analyze(text: string, recipientIds: string[] = ["b@example.com"], config: Config | undefined = CONFIG) {
  const message = buildMessage(text, recipientIds);
  const headAct = identifyHeadAct(text, segmentSentences(text));
  if (!headAct) throw new Error(`test fixture expected a detected request: ${JSON.stringify(text)}`);
  const surface = scoreSurface(message, headAct);
  const masked = buildMaskedMessage(message, headAct, surface);
  const force = scoreForce(masked, [], config);
  const confidence = computeConfidence(message, headAct, surface.evidence, force.evidence);
  return { message, headAct, surface, force, confidence };
}

// ---------------------------------------------------------------------------
// Hand-built Evidence fixture helper, for precise control over
// eventId/weight/span/category that the full pipeline can't easily target.
// ---------------------------------------------------------------------------

let nextEvidenceId = 0;
function buildEvidence(overrides: Partial<Evidence> = {}): Evidence {
  nextEvidenceId += 1;
  return {
    id: `ev${nextEvidenceId}`,
    scorer: "force",
    category: "consequence",
    subcategory: "sanction",
    trigger: "escalate",
    span: { start: 50, end: 58 },
    messageId: "m1",
    rawWeight: 1,
    weight: 1,
    capped: false,
    eventId: `event${nextEvidenceId}`,
    note: "test evidence",
    citation: "TEST",
    ...overrides,
  };
}

function buildHeadAct(overrides: Partial<HeadAct> = {}): HeadAct {
  const span: Span = { start: 0, end: 10 };
  return { span, ccsarpLevel: 3, strategyName: "ability_question", verb: "review", object: "deck", ...overrides };
}

describe("computeConfidence: clean exact request scores high (Task 5.1)", () => {
  it("exact head act + resolvable addressee + clean partition + a deadline event lands in the high band", () => {
    const { confidence } = analyze("Could you send it by Friday?");
    expect(confidence.value).toBeGreaterThanOrEqual(0.8);
    expect(confidence.value).toBeLessThanOrEqual(CONFIDENCE_MAX);
    expect(confidence.reasons).toContain("Exact lexical head-act match");
    expect(confidence.reasons).toContain("Resolvable addressee");
    expect(confidence.reasons).toContain("Surface/force partition is clean");
    expect(confidence.ambiguityFlags).toEqual([]);
  });
});

describe("computeConfidence: zero force events does not depress confidence (Task 5.2)", () => {
  it("a plain request with no force evidence still gets base + head-act + addressee + clean-partition, no penalty", () => {
    const { force, confidence } = analyze("Could you review the deck?");
    expect(force.evidence).toHaveLength(0);
    const expected = CONFIDENCE_BASE + HEAD_ACT_EXACT_BONUS + RESOLVABLE_ADDRESSEE_BONUS + CLEAN_PARTITION_BONUS;
    expect(confidence.value).toBeCloseTo(expected, 10);
    expect(confidence.reasons).toContain("0 independent force events");
  });
});

describe("computeConfidence: independent event counting (Task 5.3, 5.4, 5.10)", () => {
  const message = buildMessage("Could you review the deck?");
  const headAct = buildHeadAct();

  it("two Evidence entries sharing one eventId count as ONE independent event", () => {
    const forceEvidence = [
      buildEvidence({ eventId: "e1", weight: 2, span: { start: 50, end: 58 } }),
      buildEvidence({ eventId: "e1", weight: 3, span: { start: 60, end: 68 } }),
    ];
    const confidence = computeConfidence(message, headAct, [], forceEvidence);
    expect(confidence.reasons).toContain("1 independent force event");
    const expected = CONFIDENCE_BASE + HEAD_ACT_EXACT_BONUS + RESOLVABLE_ADDRESSEE_BONUS + CLEAN_PARTITION_BONUS + ONE_FORCE_EVENT_BONUS;
    expect(confidence.value).toBeCloseTo(expected, 10);
  });

  it("two genuinely independent eventIds earn the 2+ event bonus", () => {
    const forceEvidence = [
      buildEvidence({ eventId: "e1", weight: 2, span: { start: 50, end: 58 } }),
      buildEvidence({ eventId: "e2", weight: 3, span: { start: 60, end: 68 } }),
    ];
    const confidence = computeConfidence(message, headAct, [], forceEvidence);
    expect(confidence.reasons).toContain("2 independent force events");
    const expected = CONFIDENCE_BASE + HEAD_ACT_EXACT_BONUS + RESOLVABLE_ADDRESSEE_BONUS + CLEAN_PARTITION_BONUS + TWO_PLUS_FORCE_EVENTS_BONUS;
    expect(confidence.value).toBeCloseTo(expected, 10);
  });

  it("raw duplicate/overlapping Evidence sharing one eventId cannot artificially inflate confidence beyond the single-event case", () => {
    const single = computeConfidence(message, headAct, [], [buildEvidence({ eventId: "dup", weight: 1, span: { start: 50, end: 58 } })]);
    const fiveDuplicates = computeConfidence(
      message,
      headAct,
      [],
      [
        buildEvidence({ eventId: "dup", weight: 1, span: { start: 50, end: 58 } }),
        buildEvidence({ eventId: "dup", weight: 1, span: { start: 50, end: 58 } }),
        buildEvidence({ eventId: "dup", weight: 5, span: { start: 50, end: 58 } }),
        buildEvidence({ eventId: "dup", weight: 2, span: { start: 50, end: 58 } }),
        buildEvidence({ eventId: "dup", weight: 9, span: { start: 50, end: 58 } }),
      ],
    );
    expect(fiveDuplicates).toEqual(single);
  });

  it("zero-weight Evidence does not create an event", () => {
    const forceEvidence = [buildEvidence({ eventId: "e1", weight: 0, span: { start: 50, end: 58 } })];
    const confidence = computeConfidence(message, headAct, [], forceEvidence);
    expect(confidence.reasons).toContain("0 independent force events");
  });
});

describe("computeConfidence: unresolved temporal instant (Task 5.5)", () => {
  it("'already overdue' names no specific date — proximity stays 0 with no resolved instant, lowering confidence and flagging unresolved_temporal", () => {
    const { confidence, force } = analyze("Could you send it? This is already overdue.");
    const proximity = force.evidence.find((e) => e.subcategory === "temporal.proximity");
    expect(proximity?.weight).toBe(0);
    expect(proximity?.note).toContain("no calendar instant could be resolved");
    expect(confidence.ambiguityFlags).toContain("unresolved_temporal");
    expect(confidence.reasons).toContain("Unresolved temporal instant");

    const baseline = analyze("Could you review the deck?").confidence.value;
    expect(confidence.value).toBeLessThan(baseline);
  });
});

describe("computeConfidence: businessDayEnd/default-calendar assumption (Task 5.6)", () => {
  it("dynamic 'today' with no Config.businessDayEnd supplied lowers confidence and flags temporal_assumption", () => {
    // NOTE: analyze()'s `config` parameter has a default value, so explicitly passing
    // `undefined` would still substitute CONFIG (JS default-parameter semantics apply to an
    // explicit `undefined` argument too) — the pipeline is built by hand here instead, calling
    // scoreForce with no config argument at all, to genuinely exercise the omitted-businessDayEnd
    // fallback (SPEC.md §9.1).
    const text = "Could you send it today?";
    const message = buildMessage(text);
    const headAct = identifyHeadAct(text, segmentSentences(text));
    if (!headAct) throw new Error("test fixture expected a detected request");
    const surface = scoreSurface(message, headAct);
    const masked = buildMaskedMessage(message, headAct, surface);
    const force = scoreForce(masked, []);
    const confidence = computeConfidence(message, headAct, surface.evidence, force.evidence);

    const rung = force.evidence.find((e) => e.category === "temporal" && e.subcategory !== "temporal.proximity");
    expect(rung?.note).toContain("Config.businessDayEnd was omitted");
    expect(confidence.ambiguityFlags).toContain("temporal_assumption");
    expect(confidence.reasons).toContain("Explicit temporal/calendar assumption applied");
  });

  it("when businessDayEnd IS supplied, no temporal_assumption flag is set", () => {
    const { confidence } = analyze("Could you send it today?", ["b@example.com"], CONFIG);
    expect(confidence.ambiguityFlags).not.toContain("temporal_assumption");
  });
});

describe("computeConfidence: surface/force partition overlap (Task 5.7)", () => {
  it("an overlapping force span applies the overlap penalty instead of the clean-partition bonus, and flags surface_force_overlap", () => {
    const message = buildMessage("Could you review the deck?");
    const headAct = buildHeadAct();
    const surfaceEvidence = [buildEvidence({ scorer: "surface", category: "directness", subcategory: "ability_question", span: { start: 5, end: 15 } })];
    const forceEvidence = [buildEvidence({ span: { start: 10, end: 20 }, eventId: "e1", weight: 1 })];

    const confidence = computeConfidence(message, headAct, surfaceEvidence, forceEvidence);
    expect(confidence.ambiguityFlags).toContain("surface_force_overlap");
    expect(confidence.reasons).toContain("Surface/force partition overlaps");
    expect(confidence.reasons).not.toContain("Surface/force partition is clean");

    const expected = CONFIDENCE_BASE + HEAD_ACT_EXACT_BONUS + RESOLVABLE_ADDRESSEE_BONUS - PARTITION_OVERLAP_PENALTY + ONE_FORCE_EVENT_BONUS;
    expect(confidence.value).toBeCloseTo(expected, 10);
  });

  it("non-overlapping spans do not flag surface_force_overlap", () => {
    const message = buildMessage("Could you review the deck?");
    const headAct = buildHeadAct();
    const surfaceEvidence = [buildEvidence({ scorer: "surface", category: "directness", subcategory: "ability_question", span: { start: 0, end: 5 } })];
    const forceEvidence = [buildEvidence({ span: { start: 10, end: 20 }, eventId: "e1", weight: 1 })];

    const confidence = computeConfidence(message, headAct, surfaceEvidence, forceEvidence);
    expect(confidence.ambiguityFlags).not.toContain("surface_force_overlap");
  });
});

describe("computeConfidence: maximum never exceeds 0.95 (Task 5.8)", () => {
  it("the maximal legitimate combination of bonuses caps at exactly CONFIDENCE_MAX", () => {
    const message = buildMessage("Could you review the deck?");
    const headAct = buildHeadAct();
    const forceEvidence = [
      buildEvidence({ eventId: "e1", weight: 2, span: { start: 50, end: 58 } }),
      buildEvidence({ eventId: "e2", weight: 3, span: { start: 60, end: 68 } }),
      buildEvidence({ eventId: "e3", weight: 4, span: { start: 70, end: 78 } }),
      buildEvidence({ eventId: "e4", weight: 5, span: { start: 80, end: 88 } }),
    ];
    const confidence = computeConfidence(message, headAct, [], forceEvidence);
    expect(confidence.value).toBe(CONFIDENCE_MAX);
    expect(confidence.value).toBeLessThanOrEqual(CONFIDENCE_MAX);
  });
});

describe("computeConfidence: determinism (Task 5.9)", () => {
  it("same inputs produce a deep-equal Confidence output across repeated calls", () => {
    const message = buildMessage("Could you send it by Friday? This is blocked on Legal.");
    const headAct = buildHeadAct();
    const surfaceEvidence = [buildEvidence({ scorer: "surface", category: "directness", subcategory: "ability_question", span: { start: 0, end: 5 } })];
    const forceEvidence = [
      buildEvidence({ eventId: "e1", weight: 1, span: { start: 20, end: 30 } }),
      buildEvidence({ eventId: "e2", weight: 2, span: { start: 40, end: 50 } }),
    ];

    const first = computeConfidence(message, headAct, surfaceEvidence, forceEvidence);
    const second = computeConfidence(message, headAct, surfaceEvidence, forceEvidence);
    expect(second).toEqual(first);

    const thirdWithFreshArrays = computeConfidence(
      { ...message },
      { ...headAct },
      surfaceEvidence.map((e) => ({ ...e })),
      forceEvidence.map((e) => ({ ...e })),
    );
    expect(thirdWithFreshArrays).toEqual(first);
  });

  it("full pipeline: re-running analyze on equivalent input produces a deep-equal Confidence", () => {
    const a = analyze("Could you send it by Friday?");
    const b = analyze("Could you send it by Friday?");
    expect(b.confidence).toEqual(a.confidence);
  });
});

describe("computeConfidence: unimplemented head-act levels never earn the exact bonus", () => {
  it("a hypothetical L8/L9 headAct (not currently producible by identifyHeadAct, but guarded here) does not earn HEAD_ACT_EXACT_BONUS", () => {
    const message = buildMessage("Could you review the deck?");
    const headAct = buildHeadAct({ ccsarpLevel: 9 });
    const confidence = computeConfidence(message, headAct, [], []);
    expect(confidence.reasons).not.toContain("Exact lexical head-act match");
    const expected = CONFIDENCE_BASE + RESOLVABLE_ADDRESSEE_BONUS + CLEAN_PARTITION_BONUS;
    expect(confidence.value).toBeCloseTo(expected, 10);
  });
});
