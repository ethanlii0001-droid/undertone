/**
 * Asserts the surface/force independence claim (SPEC.md §5.1; CLAUDE.md
 * rule 3) against all 120 core minimal pairs (EVAL.md's six families),
 * plus the 10 negative controls. These tests are EXPECTED TO FAIL right
 * now — score() throws "not implemented" (src/index.ts) because no scoring
 * rule exists yet. That is the point of test-first: this file defines what
 * "correct" means before any implementation exists to satisfy it.
 *
 * Per-pair thresholds (minSurfaceDelta/forceDeltaMax or
 * surfaceDeltaMax/minForceDelta) are read directly from each fixture's own
 * `expected` object — copied from EVAL.md, not invented here. An earlier
 * version of this file used a single hardcoded surface-delta bar (>= 4.0)
 * for a 40-pair subset; that doesn't generalize to families 4–6, where
 * surface is supposed to stay fixed and force is what's supposed to move,
 * so it's been replaced by EVAL.md's own per-pair annotations.
 *
 * Negative-control math: SPEC.md §8's force formula is
 * `3.0 + (non-negative contributions only)` — no negative-weight force
 * mitigators in v1.1 (SPEC.md §7.2). A detected request can never score
 * below the 3.0 baseline, so "low force" is only satisfiable as
 * force === 3.0, or as suppression (no request detected), matching
 * EVAL.md's own nc-01 wording ("force at baseline or suppressed").
 *
 * Hard cases are loaded (see fixtures/hard-cases.ts) but not asserted on
 * here — their `expected` values are heterogeneous free text, not a
 * comparable formula, and turning them into pass/fail logic would mean
 * inventing behavior EVAL.md doesn't itself specify.
 */
import { describe, it, expect } from "vitest";
import { score } from "../src/index.js";
import type { Thread } from "../src/types.js";
import {
  corePairs,
  FAMILIES,
  pairsByFamily,
  type MessagePair,
  type TestThread,
} from "./fixtures/core-pairs.js";
import { negativeControls } from "./fixtures/negative-controls.js";
import { hardCases } from "./fixtures/hard-cases.js";

/** EVAL.md's deterministic fixture clock: Monday 2026-08-17 09:00:00-04:00, businessDayEnd 17:00. */
const FIXTURE_TIMESTAMP = new Date("2026-08-17T09:00:00-04:00");
const FIXTURE_CONFIG = { businessDayEnd: "17:00" };

const SENDER_IDS: Record<string, string> = {
  A: "sender-a@example.com",
  B: "sender-b@example.com",
};

function resolveParticipant(label: string): string {
  return SENDER_IDS[label] ?? `${label.toLowerCase()}@example.com`;
}

function isTestThread(value: string | TestThread): value is TestThread {
  return Array.isArray(value);
}

/** Builds a Thread from either a plain string (single message, fixture clock) or a TestThread (minutesBefore-relative multi-message escalation). */
function buildThread(threadId: string, variant: string | TestThread): Thread {
  if (!isTestThread(variant)) {
    return {
      id: threadId,
      messages: [
        {
          id: `${threadId}-m0`,
          threadId,
          senderId: resolveParticipant("A"),
          recipientIds: [resolveParticipant("B")],
          mentionedIds: [],
          timestamp: FIXTURE_TIMESTAMP.toISOString(),
          text: variant,
        },
      ],
    };
  }

  return {
    id: threadId,
    messages: variant.map((item, index) => ({
      id: `${threadId}-m${index}`,
      threadId,
      senderId: resolveParticipant(item.sender),
      recipientIds: [resolveParticipant(item.recipient)],
      mentionedIds: [],
      timestamp: new Date(FIXTURE_TIMESTAMP.getTime() - item.minutesBefore * 60_000).toISOString(),
      text: item.text,
    })),
  };
}

/** Scores a thread and returns the MessageAnalysis for its final (most recent) message — the one carrying the request under test. */
function analyzeVariant(threadId: string, variant: string | TestThread) {
  const thread = buildThread(threadId, variant);
  const result = score(thread, FIXTURE_CONFIG);
  const message = result.messages[result.messages.length - 1];
  if (!message) {
    throw new Error(`score() returned no MessageAnalysis for ${threadId}`);
  }
  return message;
}

function isSurfaceManipulation(
  expected: MessagePair["expected"],
): expected is import("./fixtures/core-pairs.js").ExpectedSurfaceManipulation {
  return "surfaceRelation" in expected;
}

describe("fixture integrity", () => {
  it("loads exactly 120 core pairs, 20 per family", () => {
    expect(corePairs.length).toBe(120);
    for (const family of FAMILIES) {
      expect(pairsByFamily(family).length, `family ${family}`).toBe(20);
    }
  });

  it("loads exactly 10 negative controls", () => {
    expect(negativeControls.length).toBe(10);
  });

  it("loads exactly 10 hard cases", () => {
    expect(hardCases.length).toBe(10);
  });
});

for (const family of FAMILIES) {
  describe(`independence: ${family}`, () => {
    for (const pair of pairsByFamily(family)) {
      it(`${pair.id}: ${pair.expected.claim}`, () => {
        const a = analyzeVariant(`${pair.id}-a`, pair.a);
        const b = analyzeVariant(`${pair.id}-b`, pair.b);

        expect(a.surface, `${pair.id}: a.surface must be a number`).not.toBeNull();
        expect(b.surface, `${pair.id}: b.surface must be a number`).not.toBeNull();
        expect(a.force, `${pair.id}: a.force must be a number`).not.toBeNull();
        expect(b.force, `${pair.id}: b.force must be a number`).not.toBeNull();

        const surfaceDelta = (a.surface ?? 0) - (b.surface ?? 0);
        const forceDelta = (a.force ?? 0) - (b.force ?? 0);

        if (isSurfaceManipulation(pair.expected)) {
          const { surfaceRelation, minSurfaceDelta, forceDeltaMax } = pair.expected;
          expect(
            Math.abs(forceDelta),
            `${pair.id}: |force(a) - force(b)| <= ${forceDeltaMax}`,
          ).toBeLessThanOrEqual(forceDeltaMax);
          if (surfaceRelation === "a > b") {
            expect(surfaceDelta, `${pair.id}: surface(a) - surface(b) >= ${minSurfaceDelta}`).toBeGreaterThanOrEqual(
              minSurfaceDelta,
            );
          } else {
            expect(-surfaceDelta, `${pair.id}: surface(b) - surface(a) >= ${minSurfaceDelta}`).toBeGreaterThanOrEqual(
              minSurfaceDelta,
            );
          }
        } else {
          const { forceRelation, minForceDelta, surfaceDeltaMax } = pair.expected;
          expect(
            Math.abs(surfaceDelta),
            `${pair.id}: |surface(a) - surface(b)| <= ${surfaceDeltaMax}`,
          ).toBeLessThanOrEqual(surfaceDeltaMax);
          if (forceRelation === "a > b") {
            expect(forceDelta, `${pair.id}: force(a) - force(b) >= ${minForceDelta}`).toBeGreaterThanOrEqual(
              minForceDelta,
            );
          } else {
            expect(-forceDelta, `${pair.id}: force(b) - force(a) >= ${minForceDelta}`).toBeGreaterThanOrEqual(
              minForceDelta,
            );
          }
        }
      });
    }
  });
}

describe("independence: negative controls", () => {
  for (const control of negativeControls) {
    it(`${control.id}: force === 3.0 (baseline) or suppressed (${control.note})`, () => {
      const analysis = analyzeVariant(control.id, control.message);

      const atBaselineOrSuppressed = analysis.suppressed !== undefined || analysis.force === 3.0;

      expect(
        atBaselineOrSuppressed,
        `${control.id}: expected force === 3.0 or suppressed, got force=${analysis.force}, suppressed=${analysis.suppressed}`,
      ).toBe(true);
    });
  }
});
