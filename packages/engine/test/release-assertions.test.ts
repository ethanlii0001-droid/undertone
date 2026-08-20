/**
 * Detailed, per-item release-invariant tests for the measurable SPEC.md
 * §15.3 assertions (A-F in this prompt), covering assertions without
 * duplicating hundreds of existing independence.test.ts/event-dedupe.test.ts
 * assertions unnecessarily. Reuses eval/report.ts's fixture-driven
 * computations (analyzeAllCorePairs, collectScoredCorePairMessages,
 * analyzeVariant, FIXTURE_CONFIG) rather than re-deriving the same
 * iteration over corePairs a second time — eval/report.ts's own assertion
 * functions produce the aggregate PASS/FAIL/PARTIAL summary (see
 * eval-report.test.ts); this file asserts on the same underlying data at
 * per-item granularity so a regression in a specific pair/message fails
 * loudly with its own id, not just as a moved percentage.
 *
 * Aggregate/statistical checks that eval/report.ts already computes fully
 * (dedup, intent guard, performance, network egress) are exercised via
 * eval-report.test.ts instead of a second time here.
 */
import { describe, it, expect } from "vitest";
import { FORCE_BASELINE } from "../src/force/score.js";
import {
  analyzeAllCorePairs,
  analyzeVariant,
  collectScoredCorePairMessages,
  type CorePairAnalysis,
  type ScoredMessageContext,
} from "../../../eval/report.js";
import { SURFACE_MANIPULATION_FAMILIES, FORCE_MANIPULATION_FAMILIES, type ExpectedSurfaceManipulation } from "./fixtures/core-pairs.js";

// Computed once at module scope and shared across every describe block below
// (120 thread-pair scorings; cheap, and keeps every `it` focused on one property).
const corePairAnalysis: CorePairAnalysis[] = analyzeAllCorePairs();
const scoredMessages: ScoredMessageContext[] = collectScoredCorePairMessages();

describe("release invariants: fixture harness sanity", () => {
  it("analyzed all 120 core pairs and collected a non-trivial number of scored messages", () => {
    expect(corePairAnalysis.length).toBe(120);
    expect(scoredMessages.length).toBeGreaterThan(100);
  });
});

// ---------------------------------------------------------------------------
// A. Evidence span fidelity (SPEC.md §15.3 #7, first half) — per-item.
// ---------------------------------------------------------------------------

describe("release assertion A: evidence span fidelity, across every scored core-pair message", () => {
  for (const { contextId, message, originalText } of scoredMessages) {
    for (const e of [...message.surfaceEvidence, ...message.forceEvidence]) {
      it(`${contextId} ${e.id}: integer half-open span inside source text, trigger reconstructs, messageId correct`, () => {
        expect(Number.isInteger(e.span.start), "span.start integer").toBe(true);
        expect(Number.isInteger(e.span.end), "span.end integer").toBe(true);
        expect(e.span.start, "0 <= span.start").toBeGreaterThanOrEqual(0);
        expect(e.span.start, "span.start < span.end").toBeLessThan(e.span.end);
        expect(e.span.end, "span.end <= text.length").toBeLessThanOrEqual(originalText.length);
        expect(e.trigger, "trigger === text.slice(start, end)").toBe(originalText.slice(e.span.start, e.span.end));
        expect(e.messageId, "messageId matches the MessageAnalysis it belongs to").toBe(message.messageId);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// B. Evidence reconstruction (SPEC.md §15.3 #7, second half) — per-message.
// surface: sum(surfaceEvidence.weight) reconstructs the emitted surface
// score (surface/score.ts's own aggregate-clamp rescale bookkeeping —
// verified by reading that module rather than inventing a formula: the
// directness Evidence's weight IS baseStrategy, and every modifier
// contribution's weight is rescaled so the total always equals `surface`).
// force: FORCE_BASELINE + sum(forceEvidence.weight) reconstructs the
// emitted force score, per force/score.ts's identical bookkeeping and this
// prompt's own stated formula.
// ---------------------------------------------------------------------------

describe("release assertion B: evidence reconstruction, across every scored core-pair message", () => {
  for (const { contextId, message } of scoredMessages) {
    if (message.surface !== null) {
      it(`${contextId}: sum(surfaceEvidence.weight) === surface`, () => {
        const sum = message.surfaceEvidence.reduce((s, e) => s + e.weight, 0);
        expect(sum).toBeCloseTo(message.surface as number, 6);
      });
    }
    if (message.force !== null) {
      it(`${contextId}: FORCE_BASELINE + sum(forceEvidence.weight) === force`, () => {
        const sum = message.forceEvidence.reduce((s, e) => s + e.weight, 0);
        expect(FORCE_BASELINE + sum).toBeCloseTo(message.force as number, 6);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// C. Surface/force partition (SPEC.md §15.3 #8) — per-message, 100% hard fail.
// ---------------------------------------------------------------------------

describe("release assertion C: surface/force partition, across every scored core-pair message", () => {
  for (const { contextId, message } of scoredMessages) {
    it(`${contextId}: no surface Evidence span overlaps any force Evidence span`, () => {
      for (const s of message.surfaceEvidence) {
        for (const f of message.forceEvidence) {
          const overlaps = s.span.start < f.span.end && f.span.start < s.span.end;
          expect(overlaps, `surface ${JSON.stringify(s.trigger)} (${s.span.start}-${s.span.end}) vs force ${JSON.stringify(f.trigger)} (${f.span.start}-${f.span.end})`).toBe(false);
        }
      }
    });
  }
});

// ---------------------------------------------------------------------------
// D. Determinism (SPEC.md §15.3 #10) — full 120-pair sweep at per-pair
// granularity (eval-report.test.ts's report only samples one pair per
// family, for a compact aggregate; this covers all 120 so a determinism
// regression in any single pair fails with its own id). analyzeVariant is
// pure, so calling it twice with the SAME threadId must reproduce an
// identical MessageAnalysis (messageId and eventIds included).
// ---------------------------------------------------------------------------

describe("release assertion D: determinism, across all 120 core pairs (both variants)", () => {
  for (const pair of corePairAnalysis.map((p) => p.pair)) {
    for (const label of ["a", "b"] as const) {
      it(`${pair.id}-${label}: scoring the identical Thread+Config twice yields deep-equal scores/Evidence/eventIds/confidence/gap/band/suppression`, () => {
        const threadId = `determinism-${pair.id}-${label}`;
        const run1 = analyzeVariant(threadId, pair[label]);
        const run2 = analyzeVariant(threadId, pair[label]);
        expect(run2).toEqual(run1);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// E. Gap direction (SPEC.md §15.3 #5) — mechanically derived from each
// pair's own surfaceRelation/forceRelation annotation; SPEC.md explicitly
// forbids per-ID exceptions, so this stays one aggregate expectation
// (>=95% overall), recomputed directly against corePairAnalysis here for
// transparency alongside eval/report.ts's own copy of the same computation.
// ---------------------------------------------------------------------------

function isSurfaceManipulationPair(expected: CorePairAnalysis["pair"]["expected"]): expected is ExpectedSurfaceManipulation {
  return "surfaceRelation" in expected;
}

describe("release assertion E: expected gap direction (SPEC.md §15.3 #5, >=95% overall, no per-ID exceptions)", () => {
  it("gap moves in the direction implied by each pair's own surfaceRelation/forceRelation annotation on >= 95% of the 120 core pairs", () => {
    let correct = 0;
    const failures: string[] = [];
    for (const { pair, a, b } of corePairAnalysis) {
      if (a.gap === null || b.gap === null) continue;
      const ok = isSurfaceManipulationPair(pair.expected)
        ? pair.expected.surfaceRelation === "a > b"
          ? a.gap < b.gap
          : b.gap < a.gap
        : pair.expected.forceRelation === "a > b"
          ? a.gap > b.gap
          : b.gap > a.gap;
      if (ok) correct++;
      else failures.push(pair.id);
    }
    const rate = correct / corePairAnalysis.length;
    expect(rate, `gap-direction success rate ${(rate * 100).toFixed(1)}% (failing: ${failures.join(", ")})`).toBeGreaterThanOrEqual(0.95);
  });
});

// ---------------------------------------------------------------------------
// F. CCSARP ordinal monotonicity (SPEC.md §15.3 #6) — strict for
// implemented L1-L7, external force and modifiers held constant (no
// downgraders/upgraders present in any of these seven sentences except the
// grammatically-inherent interrogative on the L7 question form, which does
// not change the ordering: L7's clamped surface, 3.1, still sits strictly
// below L6's 4.5). L8/L9 are NOT faked — see eval/report.ts's
// assertCcsarpMonotonicity and eval-report.test.ts's structural check that
// assertion #6's status is never reported as a full PASS.
// ---------------------------------------------------------------------------

describe("release assertion F: CCSARP ordinal monotonicity, L1-L7 strict (SPEC.md §15.3 #6)", () => {
  const levels: ReadonlyArray<{ level: number; text: string }> = [
    { level: 1, text: "Send the deck." },
    { level: 2, text: "I'm asking you to send the deck." },
    { level: 3, text: "I'd like to ask you to send the deck." },
    { level: 4, text: "You need to send the deck." },
    { level: 5, text: "I want you to send the deck." },
    { level: 6, text: "We could send the deck." },
    { level: 7, text: "Can you send the deck?" },
  ];

  const scored = levels.map(({ level, text }) => ({ level, text, a: analyzeVariant(`release-ccsarp-l${level}`, text) }));

  for (const { level, text, a } of scored) {
    it(`"${text}" is matched as CCSARP level ${level}`, () => {
      expect(a.headAct?.ccsarpLevel).toBe(level);
      expect(a.surface).not.toBeNull();
    });
  }

  it("surface(L1) > surface(L2) > ... > surface(L7), strictly, with external force and modifiers held constant", () => {
    for (let i = 1; i < scored.length; i++) {
      const prev = scored[i - 1]!;
      const cur = scored[i]!;
      expect(cur.a.surface!, `surface(L${prev.level}=${prev.a.surface}) > surface(L${cur.level})`).toBeLessThan(prev.a.surface!);
    }
  });
});

// ---------------------------------------------------------------------------
// Sanity check: the surface/force manipulation family split used throughout
// this file matches core-pairs.ts's own exported family lists (guards
// against a future EVAL.md family being added without also being wired
// into eval/report.ts's assertions 1-4).
// ---------------------------------------------------------------------------

describe("release invariants: family coverage sanity", () => {
  it("every core pair belongs to exactly one of the surface- or force-manipulation family lists", () => {
    for (const { pair } of corePairAnalysis) {
      const inSurface = (SURFACE_MANIPULATION_FAMILIES as readonly string[]).includes(pair.family);
      const inForce = (FORCE_MANIPULATION_FAMILIES as readonly string[]).includes(pair.family);
      expect(inSurface !== inForce, `${pair.id} family ${pair.family}`).toBe(true);
    }
  });
});
