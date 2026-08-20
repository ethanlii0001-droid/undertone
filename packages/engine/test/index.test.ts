/**
 * Tests for the public API (src/index.ts): `score(thread, config?) =>
 * ThreadAnalysis` (SPEC.md §3, §5), the gap/band computation (SPEC.md §13),
 * suppression wiring (SPEC.md §6.1), context-only prior-message handling
 * for escalation (SPEC.md §11.4), and the purity/determinism guarantees
 * (SPEC.md §3; CLAUDE.md rule 1).
 */
import { describe, it, expect } from "vitest";
import { score, computeGap, computeGapBand } from "../src/index.js";
import { FORCE_BASELINE } from "../src/force/score.js";
import type { Message, Thread } from "../src/types.js";

let nextMessageId = 0;
function buildMessage(overrides: Partial<Message> = {}): Message {
  nextMessageId += 1;
  return {
    id: `m${nextMessageId}`,
    threadId: "t1",
    senderId: "a@example.com",
    recipientIds: ["b@example.com"],
    mentionedIds: [],
    timestamp: "2026-08-17T09:00:00-04:00",
    text: "Could you review the deck?",
    ...overrides,
  };
}

function offsetTimestamp(minutesBefore: number): string {
  const base = Date.parse("2026-08-17T09:00:00-04:00");
  const shifted = new Date(base - minutesBefore * 60_000 + -4 * 60 * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}-04:00`;
}

// ---------------------------------------------------------------------------
// 1. Gap + band (SPEC.md §13)
// ---------------------------------------------------------------------------

describe("computeGap: round1(force) - round1(surface)", () => {
  it("matches the formula on values needing no rounding", () => {
    expect(computeGap(7, 4)).toBe(3);
    expect(computeGap(3, 3)).toBe(0);
  });

  it("rounds each side to one decimal before subtracting and stays stable (no floating-point artifacts)", () => {
    // round1(4.2) - round1(3.5) === 0.7000000000000002 in raw IEEE-754 arithmetic; the outer
    // round1 must clean that back to the exact one-decimal value.
    const gap = computeGap(4.2, 3.5);
    expect(gap).toBe(0.7);
    expect(Number.isInteger(gap * 10)).toBe(true);
  });
});

describe("computeGapBand: SPEC.md §13 boundaries", () => {
  it("gap = 3.0 -> under-phrased", () => {
    expect(computeGapBand(3.0)).toBe("under-phrased");
  });
  it("gap = 1.0 -> mildly-under-phrased", () => {
    expect(computeGapBand(1.0)).toBe("mildly-under-phrased");
  });
  it("gap just below 1.0 (0.9) -> aligned", () => {
    expect(computeGapBand(0.9)).toBe("aligned");
  });
  it("gap = -1.0 -> mildly-over-phrased", () => {
    expect(computeGapBand(-1.0)).toBe("mildly-over-phrased");
  });
  it("gap just above -3.0 (-2.9) -> mildly-over-phrased", () => {
    expect(computeGapBand(-2.9)).toBe("mildly-over-phrased");
  });
  it("gap = -3.0 -> over-phrased", () => {
    expect(computeGapBand(-3.0)).toBe("over-phrased");
  });
  it("gap just below 3.0 (2.9) -> mildly-under-phrased", () => {
    expect(computeGapBand(2.9)).toBe("mildly-under-phrased");
  });
  it("gap just above -1.0 (-0.9) -> aligned", () => {
    expect(computeGapBand(-0.9)).toBe("aligned");
  });
});

// ---------------------------------------------------------------------------
// 5. Public pipeline
// ---------------------------------------------------------------------------

describe("score: a normal request scores fully (Task 5.1)", () => {
  it("produces non-null surface/force/gap/band/confidence", () => {
    const thread: Thread = { id: "t1", messages: [buildMessage({ text: "Could you review the deck?" })] };
    const result = score(thread);
    const analysis = result.messages[0];
    expect(analysis).toBeDefined();
    expect(analysis?.headAct).not.toBeNull();
    expect(analysis?.surface).not.toBeNull();
    expect(analysis?.force).not.toBeNull();
    expect(analysis?.gap).not.toBeNull();
    expect(analysis?.band).not.toBeNull();
    expect(analysis?.confidence).not.toBeNull();
    expect(analysis?.suppressed).toBeUndefined();
  });
});

describe("score: no request suppresses as no_head_act (Task 5.2)", () => {
  it("all score fields are null and evidence arrays are empty", () => {
    const thread: Thread = { id: "t1", messages: [buildMessage({ text: "Thanks for the update." })] };
    const analysis = score(thread).messages[0];
    expect(analysis?.suppressed).toBe("no_head_act");
    expect(analysis?.headAct).toBeNull();
    expect(analysis?.surface).toBeNull();
    expect(analysis?.force).toBeNull();
    expect(analysis?.gap).toBeNull();
    expect(analysis?.band).toBeNull();
    expect(analysis?.confidence).toBeNull();
    expect(analysis?.surfaceEvidence).toEqual([]);
    expect(analysis?.forceEvidence).toEqual([]);
  });
});

describe("score: empty recipientIds suppresses as unresolved_addressee (Task 5.3)", () => {
  it("keeps the detected headAct but nulls every score field", () => {
    const thread: Thread = { id: "t1", messages: [buildMessage({ text: "Could you review the deck?", recipientIds: [] })] };
    const analysis = score(thread).messages[0];
    expect(analysis?.suppressed).toBe("unresolved_addressee");
    expect(analysis?.headAct).not.toBeNull();
    expect(analysis?.surface).toBeNull();
    expect(analysis?.force).toBeNull();
    expect(analysis?.gap).toBeNull();
    expect(analysis?.band).toBeNull();
    expect(analysis?.confidence).toBeNull();
    expect(analysis?.surfaceEvidence).toEqual([]);
    expect(analysis?.forceEvidence).toEqual([]);
  });
});

describe("score: a recipient completion signal breaks the repetition chain (Task 5.4)", () => {
  it("A -> B request, B -> A 'done', A -> B same request: the third message gets no verified-restatement bonus", () => {
    const thread: Thread = {
      id: "t1",
      messages: [
        buildMessage({ senderId: "a@example.com", recipientIds: ["b@example.com"], timestamp: offsetTimestamp(2880), text: "Could you review the deck?" }),
        buildMessage({ senderId: "b@example.com", recipientIds: ["a@example.com"], timestamp: offsetTimestamp(1440), text: "done" }),
        buildMessage({ senderId: "a@example.com", recipientIds: ["b@example.com"], timestamp: offsetTimestamp(0), text: "Could you review the deck?" }),
      ],
    };
    const result = score(thread);
    const third = result.messages[2];
    expect(third?.forceEvidence.some((e) => e.subcategory === "verified_restatement")).toBe(false);
    expect(third?.force).toBe(FORCE_BASELINE);
  });
});

describe("score: an unrelated third party's completion signal does not break the chain (Task 5.5)", () => {
  it("A -> B request, C sends 'done' (not a recipient of the current request), A -> B same request: verified repetition still applies", () => {
    const thread: Thread = {
      id: "t1",
      messages: [
        buildMessage({ senderId: "a@example.com", recipientIds: ["b@example.com"], timestamp: offsetTimestamp(2880), text: "Could you review the deck?" }),
        buildMessage({ senderId: "c@example.com", recipientIds: ["b@example.com"], timestamp: offsetTimestamp(1440), text: "done" }),
        buildMessage({ senderId: "a@example.com", recipientIds: ["b@example.com"], timestamp: offsetTimestamp(0), text: "Could you review the deck?" }),
      ],
    };
    const result = score(thread);
    const third = result.messages[2];
    expect(third?.forceEvidence.some((e) => e.subcategory === "verified_restatement")).toBe(true);
    expect(third?.force ?? 0).toBeGreaterThan(FORCE_BASELINE);
  });
});

describe("score: surface/force independence through the public API (Task 5.6)", () => {
  it("imperative vs ability-question realization of the same request+deadline: surface differs, force is invariant", () => {
    const direct = score({
      id: "t-direct",
      messages: [buildMessage({ text: "Review the deck before Thursday's client call." })],
    }).messages[0];
    const mitigated = score({
      id: "t-mitigated",
      messages: [buildMessage({ text: "Could you review the deck before Thursday's client call?" })],
    }).messages[0];

    expect(direct?.surface ?? 0).toBeGreaterThan(mitigated?.surface ?? 0);
    expect(direct?.force).toBeCloseTo(mitigated?.force ?? 0, 9);
  });
});

describe("score: determinism (Task 5.7)", () => {
  it("repeated calls with equivalent input produce a deep-equal ThreadAnalysis", () => {
    const buildEquivalentThread = (): Thread => ({
      id: "t1",
      messages: [
        { id: "m1", threadId: "t1", senderId: "a@example.com", recipientIds: ["b@example.com"], mentionedIds: [], timestamp: "2026-08-17T09:00:00-04:00", text: "Could you send it by Friday?" },
      ],
    });
    const first = score(buildEquivalentThread(), { businessDayEnd: "17:00" });
    const second = score(buildEquivalentThread(), { businessDayEnd: "17:00" });
    expect(second).toEqual(first);
  });
});

describe("score: input immutability (Task 5.8)", () => {
  function deepFreeze<T>(value: T): T {
    if (value !== null && (typeof value === "object" || typeof value === "function")) {
      for (const key of Object.getOwnPropertyNames(value as object)) {
        deepFreeze((value as Record<string, unknown>)[key]);
      }
      Object.freeze(value);
    }
    return value;
  }

  it("does not mutate a deep-frozen Thread input", () => {
    const thread: Thread = deepFreeze({
      id: "t1",
      messages: [buildMessage({ text: "Could you send it by Friday? This is blocked on Legal." })],
    });
    const snapshot = JSON.parse(JSON.stringify(thread));
    expect(() => score(thread)).not.toThrow();
    expect(JSON.parse(JSON.stringify(thread))).toEqual(snapshot);
  });

  it("does not mutate a deep-frozen Config input", () => {
    const config = deepFreeze({ businessDayEnd: "17:00" });
    const thread: Thread = { id: "t1", messages: [buildMessage({ text: "Could you send it today?" })] };
    expect(() => score(thread, config)).not.toThrow();
    expect(config).toEqual({ businessDayEnd: "17:00" });
  });
});

describe("score: empty thread (Task 5.9)", () => {
  it("returns a valid ThreadAnalysis with zero messages", () => {
    const result = score({ id: "empty", messages: [] });
    expect(result).toEqual({ messages: [] });
  });
});

describe("score: does not throw merely because one message is suppressed", () => {
  it("a mixed thread of a suppressed message and a scoreable one returns both analyses", () => {
    const thread: Thread = {
      id: "t1",
      messages: [
        buildMessage({ timestamp: offsetTimestamp(60), text: "Thanks for the update." }),
        buildMessage({ timestamp: offsetTimestamp(0), text: "Could you review the deck?" }),
      ],
    };
    const result = score(thread);
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]?.suppressed).toBe("no_head_act");
    expect(result.messages[1]?.suppressed).toBeUndefined();
    expect(result.messages[1]?.surface).not.toBeNull();
  });
});
