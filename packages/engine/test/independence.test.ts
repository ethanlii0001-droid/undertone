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

/**
 * EVAL.md's deterministic fixture clock (EVAL.md "Deterministic fixture
 * clock"): Monday 2026-08-17 09:00:00-04:00, businessDayEnd 17:00. Kept as
 * the literal authoritative string, not round-tripped through
 * `Date#toISOString()` — that method always renders Z/UTC, which would
 * silently discard the explicit -04:00 offset. The offset is semantically
 * relevant to dynamic today/EOD/COB resolution (SPEC.md §9.1), so every
 * generated fixture timestamp — including minutesBefore-derived
 * TestThread timestamps — must keep it.
 */
const FIXTURE_TIMESTAMP = "2026-08-17T09:00:00-04:00";
const FIXTURE_OFFSET = "-04:00";
/** Minutes east of UTC for the fixed -04:00 fixture offset. Never the runtime/local offset. */
const FIXTURE_OFFSET_MINUTES = -4 * 60;
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

/**
 * Formats the instant `minutesBefore` minutes before FIXTURE_TIMESTAMP as
 * an ISO 8601 string carrying the same explicit -04:00 offset. Computed
 * entirely from the fixed offset and epoch arithmetic on the literal
 * FIXTURE_TIMESTAMP string — never reads `Date.now()` or the runtime's
 * local timezone (CLAUDE.md rule 1). `minutesBefore === 0` returns the
 * literal FIXTURE_TIMESTAMP constant rather than a round-tripped value, so
 * the base fixture timestamp is exactly EVAL.md's authoritative string.
 */
function offsetTimestamp(minutesBefore: number): string {
  if (minutesBefore === 0) return FIXTURE_TIMESTAMP;
  const baseInstantMs = Date.parse(FIXTURE_TIMESTAMP);
  const shiftedMs = baseInstantMs - minutesBefore * 60_000;
  // Read UTC getters on an instant pre-shifted by the fixed -04:00 offset,
  // so the resulting fields are the -04:00 wall clock without depending on
  // this machine's own timezone.
  const wallClock = new Date(shiftedMs + FIXTURE_OFFSET_MINUTES * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = wallClock.getUTCFullYear();
  const mm = pad(wallClock.getUTCMonth() + 1);
  const dd = pad(wallClock.getUTCDate());
  const hh = pad(wallClock.getUTCHours());
  const mi = pad(wallClock.getUTCMinutes());
  const ss = pad(wallClock.getUTCSeconds());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}${FIXTURE_OFFSET}`;
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
          timestamp: offsetTimestamp(0),
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
      timestamp: offsetTimestamp(item.minutesBefore),
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

  it("base single-message fixture timestamp is exactly EVAL.md's deterministic clock, offset preserved", () => {
    const thread = buildThread("clock-check", "Could you review the deck?");
    expect(thread.messages[0]?.timestamp).toBe("2026-08-17T09:00:00-04:00");
  });

  it("minutesBefore-derived TestThread timestamps preserve the -04:00 offset, not Z/UTC", () => {
    const thread = buildThread("clock-check-thread", [
      { minutesBefore: 1440, sender: "A", recipient: "B", text: "Could you review the deck?" },
      { minutesBefore: 0, sender: "A", recipient: "B", text: "Could you review the deck?" },
    ]);
    expect(thread.messages[0]?.timestamp).toBe("2026-08-16T09:00:00-04:00");
    expect(thread.messages[1]?.timestamp).toBe("2026-08-17T09:00:00-04:00");
    for (const message of thread.messages) {
      expect(message.timestamp.endsWith("-04:00"), message.timestamp).toBe(true);
      expect(message.timestamp.endsWith("Z"), message.timestamp).toBe(false);
    }
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
