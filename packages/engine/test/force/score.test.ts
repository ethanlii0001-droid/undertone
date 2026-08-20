/**
 * Tests for scoreForce (src/force/score.ts) — SPEC.md §8's exact formula,
 * the consequence leakage guard (SPEC.md §10.1), the dependency/
 * accountability component, the non-hierarchy rule, the masking
 * boundary, and final-clamp evidence bookkeeping. Built on the full
 * test-only mini-pipeline (identifyHeadAct -> scoreSurface ->
 * buildMaskedMessage -> scoreForce), not the still-unimplemented public
 * score().
 */
import { describe, it, expect } from "vitest";
import { segmentSentences } from "../../src/segment.js";
import { identifyHeadAct } from "../../src/headAct.js";
import { scoreSurface } from "../../src/surface/score.js";
import { buildMaskedMessage } from "../../src/mask.js";
import { scoreForce, FORCE_BASELINE, FORCE_MAX } from "../../src/force/score.js";
import type { Config, Message } from "../../src/types.js";

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

const CONFIG: Config = { businessDayEnd: "17:00" };

function score(text: string, config: Config = CONFIG) {
  const message = buildMessage(text);
  const headAct = identifyHeadAct(text, segmentSentences(text));
  if (!headAct) throw new Error(`test fixture expected a detected request: ${JSON.stringify(text)}`);
  const surface = scoreSurface(message, headAct);
  const masked = buildMaskedMessage(message, headAct, surface);
  const force = scoreForce(masked, [], config);
  return { message, headAct, surface, masked, force };
}

describe("scoreForce: baseline (SPEC.md §8)", () => {
  it("a plain request with no force event scores exactly 3.0", () => {
    const { force } = score("Could you review the deck?");
    expect(force.value).toBe(FORCE_BASELINE);
    expect(force.evidence).toHaveLength(0);
  });
});

describe("scoreForce: no negative force mitigation", () => {
  it("'No rush.' does not lower force below baseline", () => {
    const { force } = score("Could you review the deck? No rush.");
    expect(force.value).toBe(FORCE_BASELINE);
  });

  it("'No pressure' inside the request does not lower force", () => {
    const { force } = score("Could you review the deck, no pressure?");
    expect(force.value).toBe(FORCE_BASELINE);
  });

  it("force still rises normally when independent force evidence coexists with 'no rush'", () => {
    const { force } = score("Could you send it by Friday? No rush.");
    expect(force.value).toBeGreaterThan(FORCE_BASELINE);
  });
});

describe("scoreForce: temporal", () => {
  it("a deadline produces a temporal contribution", () => {
    const { force } = score("Could you send it by Friday?");
    expect(force.value).toBeGreaterThan(FORCE_BASELINE);
    expect(force.evidence.some((e) => e.category === "temporal")).toBe(true);
  });
});

describe("scoreForce: dependency", () => {
  it("a blockage produces a dependency contribution", () => {
    const { force } = score("Could you fix the pipeline? Three PRs are blocked on it.");
    expect(force.value).toBeGreaterThan(FORCE_BASELINE);
    expect(force.evidence.some((e) => e.category === "dependency" && e.subcategory === "framing")).toBe(true);
  });
});

describe("scoreForce: consequence", () => {
  it("a stated outcome produces a consequence contribution", () => {
    const { force } = score("Could you send it? Otherwise we'll miss the cutoff.");
    expect(force.value).toBeGreaterThan(FORCE_BASELINE);
    expect(force.evidence.some((e) => e.category === "consequence")).toBe(true);
  });
});

describe("scoreForce: accountability", () => {
  it("a named accountability source increases force via exactly its canonical entry", () => {
    const { force } = score("Could you send it? The client is waiting.");
    const accountability = force.evidence.find((e) => e.category === "dependency" && e.subcategory === "accountability");
    expect(accountability).toBeDefined();
    expect(accountability?.rawWeight).toBe(2.2);
    expect(force.value).toBeCloseTo(FORCE_BASELINE + 2.2 * 0.8, 9);
  });
});

describe("scoreForce: consequence leakage guard (SPEC.md §10.1)", () => {
  it("'Could you escalate this issue?' contributes zero consequence force", () => {
    const { force } = score("Could you escalate this issue?");
    expect(force.value).toBe(FORCE_BASELINE);
    expect(force.evidence.some((e) => e.category === "consequence")).toBe(false);
  });

  it("'You need to escalate this issue.' (imperative-equivalent) also contributes zero", () => {
    const { force } = score("You need to escalate this issue.");
    expect(force.value).toBe(FORCE_BASELINE);
  });

  it("'Could you reopen the ticket?' contributes zero", () => {
    const { force } = score("Could you reopen the ticket?");
    expect(force.value).toBe(FORCE_BASELINE);
  });

  it("'Could you loop in Legal?' contributes zero", () => {
    const { force } = score("Could you loop in Legal?");
    expect(force.value).toBe(FORCE_BASELINE);
  });

  it("independent outcome framing in a separate sentence DOES score, even with the sanction word", () => {
    const { force } = score("Could you send this? Otherwise we'll escalate.");
    expect(force.value).toBeGreaterThan(FORCE_BASELINE);
    expect(force.evidence.some((e) => e.category === "consequence")).toBe(true);
  });

  it("a conditional structure in the SAME sentence as the request still scores, even though the sanction verb also occurs there", () => {
    const { force } = score("Could you send this, or else we'll have to escalate.");
    expect(force.value).toBeGreaterThan(FORCE_BASELINE);
    const consequence = force.evidence.filter((e) => e.category === "consequence");
    expect(consequence.some((e) => e.subcategory === "sanction")).toBe(false);
    expect(consequence.some((e) => e.subcategory.startsWith("conditional"))).toBe(true);
  });
});

describe("scoreForce: hierarchy/power must not add weight", () => {
  it("boss/manager/leadership/board named sources add exactly their canonical entry weight, never more", () => {
    const boss = score("Could you send it? My boss is asking.");
    const client = score("Could you send it? The client is asking.");
    const leadership = score("Could you send it? Leadership wants this.");
    // All three are named accountability sources at the same canonical raw weight (2.2) — no hierarchy multiplier.
    expect(boss.force.value).toBeCloseTo(client.force.value, 9);
    expect(leadership.force.value).toBeCloseTo(client.force.value, 9);
    const bossEvidence = boss.force.evidence.find((e) => e.category === "dependency");
    expect(bossEvidence?.rawWeight).toBe(2.2);
  });
});

describe("scoreForce: masking boundary", () => {
  it("no force evidence span ever intersects a masked surface span", () => {
    const { force, masked } = score("Could you just send it by Friday? No rush.");
    for (const evidence of force.evidence) {
      for (const maskedSpan of masked.maskedSpans) {
        const overlaps = evidence.span.start < maskedSpan.end && evidence.span.end > maskedSpan.start;
        expect(overlaps, `force evidence ${JSON.stringify(evidence.trigger)} must not overlap masked span`).toBe(false);
      }
    }
  });
});

describe("scoreForce: final clamp", () => {
  it("many independent force events reach but never exceed 10.0, and evidence reconstructs the clamped score", () => {
    const text =
      "Could you send it by 5 minutes from now? Otherwise we'll breach the SLA. It is blocked on Legal, and the client is asking, and my boss is asking, and leadership wants this.";
    const { force } = score(text);
    expect(force.value).toBeLessThanOrEqual(FORCE_MAX);
    if (force.value === FORCE_MAX) {
      const sum = force.evidence.reduce((s, e) => s + e.weight, 0);
      expect(sum).toBeCloseTo(FORCE_MAX - FORCE_BASELINE, 6);
      // Prompt 6R-F Task 5: the clamp only ever rescales POSITIVE contributing evidence —
      // any zero-weight evidence present is exempt from this blanket check below.
      for (const e of force.evidence) {
        if (e.weight > 0) expect(e.capped).toBe(true);
        expect(e.rawWeight).toBeGreaterThanOrEqual(0);
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Prompt 6R-F Task 5: the outer clamp must rescale only POSITIVE contributing
  // Evidence; a zero-weight item (e.g. an unresolved temporal.proximity) must
  // stay at weight 0 with its existing `capped` state preserved, never forced
  // to `capped: true` merely because the clamp bound elsewhere.
  // ---------------------------------------------------------------------------

  it("a zero-weight Evidence item (unresolved temporal.proximity) is left at weight 0 and its own capped state, while positive evidence is rescaled and marked capped: true, when the outer clamp binds", () => {
    const text =
      "Could you send it? This is already overdue. Otherwise we'll breach the SLA. It is blocked on Legal, and the client is asking, and my boss is asking, and leadership wants this, and legal needs this.";
    const { force } = score(text);
    expect(force.value).toBe(FORCE_MAX);

    const zeroWeight = force.evidence.filter((e) => e.weight === 0);
    expect(zeroWeight.length, "this regression must actually produce a zero-weight Evidence item").toBeGreaterThan(0);
    for (const e of zeroWeight) {
      expect(e.subcategory).toBe("temporal.proximity");
      expect(e.capped).toBe(false);
    }

    const positive = force.evidence.filter((e) => e.weight > 0);
    expect(positive.length).toBeGreaterThan(0);
    for (const e of positive) expect(e.capped).toBe(true);

    // force - 3.0 must still reconstruct exactly across all Evidence, zero-weight included.
    const sum = force.evidence.reduce((s, e) => s + e.weight, 0);
    expect(sum).toBeCloseTo(FORCE_MAX - FORCE_BASELINE, 6);
  });
});

describe("scoreForce: evidence span fidelity", () => {
  it("every lexical force evidence trigger matches maskedText.slice(span)", () => {
    const { force, masked } = score("Could you send it by Friday? Otherwise we'll miss the cutoff.");
    for (const e of force.evidence) {
      if (e.category === "escalation") continue; // synthetic, documented separately
      expect(e.trigger).toBe(masked.maskedText.slice(e.span.start, e.span.end));
      expect(e.scorer).toBe("force");
      expect(e.messageId).toBe(masked.messageId);
    }
  });
});

// ---------------------------------------------------------------------------
// Prompt 6R-A Task D: the hard partition invariant, through the real
// multi-message scoreForce pipeline — including synthetic escalation
// Evidence, not just single-message lexical Evidence.
// ---------------------------------------------------------------------------

const BASE_TIME = Date.parse("2026-08-17T09:00:00-04:00");
function isoMinutesBefore(minutesBefore: number): string {
  return new Date(BASE_TIME - minutesBefore * 60_000).toISOString().replace("Z", "-04:00").replace(".000", "");
}

function buildMaskedAt(text: string, minutesBefore: number, id: string) {
  const timestamp = isoMinutesBefore(minutesBefore);
  const headAct = identifyHeadAct(text, segmentSentences(text));
  if (!headAct) throw new Error(`test fixture expected a detected request: ${JSON.stringify(text)}`);
  const message: Message = {
    id,
    threadId: "t1",
    senderId: "a@example.com",
    recipientIds: ["b@example.com"],
    mentionedIds: [],
    timestamp,
    text,
  };
  const surface = scoreSurface(message, headAct);
  return buildMaskedMessage(message, headAct, surface);
}

describe("scoreForce: hard partition invariant across a real multi-message thread (Task D)", () => {
  it("no force Evidence — lexical or synthetic escalation — ever overlaps the current message's maskedSpans", () => {
    const text = "Could you review the deck?";
    const p1 = buildMaskedAt(text, 2880, "p1");
    const p2 = buildMaskedAt(text, 480, "p2");
    const current = buildMaskedAt(text, 0, "current");

    const force = scoreForce(current, [p1, p2], CONFIG);
    const escalationEvidence = force.evidence.filter((e) => e.category === "escalation");
    expect(escalationEvidence.length, "this regression must actually produce thread-derived escalation evidence").toBeGreaterThan(0);

    for (const e of force.evidence) {
      for (const maskedSpan of current.maskedSpans) {
        const overlaps = e.span.start < maskedSpan.end && e.span.end > maskedSpan.start;
        expect(overlaps, `${e.category}/${e.subcategory} span must not overlap masked span ${JSON.stringify(maskedSpan)}`).toBe(false);
      }
    }
  });
});
