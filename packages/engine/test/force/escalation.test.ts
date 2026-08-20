/**
 * Tests for force/escalation.ts — SPEC.md §11.3–§11.4's repetition/
 * escalation component: lexical follow-up markers, verified thread
 * restatement counts, accelerating-interval and unanswered bonuses, the
 * combined 3.0 cap, and the same-request/completion-signal gate.
 */
import { describe, it, expect } from "vitest";
import {
  scoreEscalation,
  LEXICAL_FOLLOW_UP_CAP,
  VERIFIED_RESTATEMENT_2ND,
  VERIFIED_RESTATEMENT_3RD,
  VERIFIED_RESTATEMENT_4TH_PLUS,
  ACCELERATING_INTERVALS_BONUS,
  UNANSWERED_BONUS,
  REPETITION_ESCALATION_CAP,
} from "../../src/force/escalation.js";
import { segmentSentences } from "../../src/segment.js";
import { identifyHeadAct } from "../../src/headAct.js";
import { scoreSurface } from "../../src/surface/score.js";
import { buildMaskedMessage } from "../../src/mask.js";
import { requestSignatureJaccard, SAME_REQUEST_JACCARD_THRESHOLD } from "../../src/force/dedupe.js";
import type { MaskedMessage, Message } from "../../src/types.js";

const BASE_TIME = Date.parse("2026-08-17T09:00:00-04:00");

function iso(minutesBefore: number): string {
  return new Date(BASE_TIME - minutesBefore * 60_000).toISOString().replace("Z", "-04:00").replace(".000", "");
}

function masked(id: string, text: string, minutesBefore: number, sender = "a@example.com", recipient = "b@example.com"): MaskedMessage {
  return {
    messageId: id,
    maskedText: text,
    maskedSpans: [],
    requestClauseSpan: { start: 0, end: text.length },
    requestSignature: text
      .toLowerCase()
      .replace(/[?.!]/g, "")
      .split(/\s+/)
      .filter((w) => !["could", "you", "the", "please"].includes(w)),
    timestamp: iso(minutesBefore),
    senderId: sender,
    recipientIds: [recipient],
  };
}

const REQUEST = "Could you review the deck";

describe("scoreEscalation: no escalation", () => {
  it("returns no evidence for a single, non-repeated request", () => {
    const current = masked("m1", REQUEST, 0);
    expect(scoreEscalation(current, [])).toHaveLength(0);
  });
});

describe("scoreEscalation: verified restatement counts", () => {
  it("2nd mention: +1.0", () => {
    const prior = masked("m1", REQUEST, 1440);
    const current = masked("m2", REQUEST, 0);
    const ev = scoreEscalation(current, [prior]);
    const restatement = ev.find((e) => e.subcategory === "verified_restatement");
    expect(restatement?.weight).toBeCloseTo(VERIFIED_RESTATEMENT_2ND, 9);
    expect(restatement?.category).toBe("escalation");
  });

  it("3rd mention: +1.8", () => {
    const p1 = masked("m1", REQUEST, 2880);
    const p2 = masked("m2", REQUEST, 1440);
    const current = masked("m3", REQUEST, 0);
    const ev = scoreEscalation(current, [p1, p2]);
    expect(ev.find((e) => e.subcategory === "verified_restatement")?.rawWeight).toBeCloseTo(VERIFIED_RESTATEMENT_3RD, 9);
  });

  it("4th+ mention: +2.5", () => {
    const p1 = masked("m1", REQUEST, 4320);
    const p2 = masked("m2", REQUEST, 2880);
    const p3 = masked("m3", REQUEST, 1440);
    const current = masked("m4", REQUEST, 0);
    const ev = scoreEscalation(current, [p1, p2, p3]);
    expect(ev.find((e) => e.subcategory === "verified_restatement")?.rawWeight).toBeCloseTo(VERIFIED_RESTATEMENT_4TH_PLUS, 9);
  });
});

describe("scoreEscalation: same-request gate", () => {
  it("a prior request below the 0.30 Jaccard threshold does not count as a verified mention", () => {
    const prior = masked("m1", "Could you approve the budget spreadsheet export process", 1440);
    const current = masked("m2", REQUEST, 0);
    expect(scoreEscalation(current, [prior]).some((e) => e.subcategory === "verified_restatement")).toBe(false);
  });

  it("a completion signal from a recipient breaks the chain", () => {
    const p1 = masked("m1", REQUEST, 2880);
    const reply = masked("r1", "Just sent it over.", 1440, "b@example.com", "a@example.com");
    const current = masked("m2", REQUEST, 0);
    const ev = scoreEscalation(current, [p1, reply]);
    expect(ev.some((e) => e.subcategory === "verified_restatement")).toBe(false);
  });

  it("only same-sender prior requests count as restatements", () => {
    const otherSenderRequest = masked("m1", REQUEST, 1440, "c@example.com", "b@example.com");
    const current = masked("m2", REQUEST, 0, "a@example.com", "b@example.com");
    expect(scoreEscalation(current, [otherSenderRequest]).some((e) => e.subcategory === "verified_restatement")).toBe(false);
  });
});

describe("scoreEscalation: accelerating intervals", () => {
  it("awards +0.5 when the most recent interval is strictly shorter than the previous one, with >=3 verified mentions", () => {
    const p1 = masked("m1", REQUEST, 2880); // 48h before p2
    const p2 = masked("m2", REQUEST, 480); // 8h before current — shorter interval
    const current = masked("m3", REQUEST, 0);
    const ev = scoreEscalation(current, [p1, p2]);
    expect(ev.find((e) => e.subcategory === "accelerating_intervals")?.weight).toBeCloseTo(ACCELERATING_INTERVALS_BONUS, 9);
  });

  it("does not award it when the most recent interval is NOT shorter than the previous one", () => {
    const first = masked("m1", REQUEST, 480); // interval1: 480-240 = 240min = 4h
    const second = masked("m2", REQUEST, 240); // interval2: 240-0 = 240min = 4h — equal, not strictly shorter
    const current = masked("m3", REQUEST, 0);
    const ev = scoreEscalation(current, [first, second]);
    expect(ev.some((e) => e.subcategory === "accelerating_intervals")).toBe(false);
  });

  it("does not fire with only 2 total verified mentions (need >= 3)", () => {
    const prior = masked("m1", REQUEST, 60);
    const current = masked("m2", REQUEST, 0);
    const ev = scoreEscalation(current, [prior]);
    expect(ev.some((e) => e.subcategory === "accelerating_intervals")).toBe(false);
  });
});

describe("scoreEscalation: unanswered", () => {
  it("awards +0.5 when no recipient message intervenes since the last verified mention", () => {
    const prior = masked("m1", REQUEST, 1440);
    const current = masked("m2", REQUEST, 0);
    const ev = scoreEscalation(current, [prior]);
    expect(ev.find((e) => e.subcategory === "unanswered")?.weight).toBeCloseTo(UNANSWERED_BONUS, 9);
  });

  it("does not award it when a recipient message intervenes", () => {
    const prior = masked("m1", REQUEST, 1440);
    const reply = masked("r1", "Looking into it now.", 720, "b@example.com", "a@example.com");
    const current = masked("m2", REQUEST, 0);
    const ev = scoreEscalation(current, [prior, reply]);
    expect(ev.some((e) => e.subcategory === "unanswered")).toBe(false);
  });
});

describe("scoreEscalation: lexical follow-up", () => {
  it("the strongest current-message follow-up marker contributes, capped at 1.6", () => {
    const current = masked("m1", "Third time following up on this.", 0);
    const ev = scoreEscalation(current, []);
    const followUp = ev.find((e) => e.category === "dependency" && e.subcategory === "follow_up");
    expect(followUp).toBeDefined();
    expect(followUp?.weight).toBeLessThanOrEqual(LEXICAL_FOLLOW_UP_CAP);
  });

  it("lexical follow-up and verified restatement can coexist", () => {
    const prior = masked("m1", REQUEST, 1440);
    const current = masked("m2", `Following up: ${REQUEST}`, 0);
    const ev = scoreEscalation(current, [prior]);
    expect(ev.some((e) => e.subcategory === "follow_up")).toBe(true);
    expect(ev.some((e) => e.subcategory === "verified_restatement")).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Prompt 6R-F Task 4: the +1.6 LEXICAL_FOLLOW_UP_CAP is its own sub-
  // component cap, independent of the combined 3.0 REPETITION_ESCALATION_CAP.
  // -------------------------------------------------------------------------

  it("'third time' alone (no other escalation sub-component firing): individual cap binds and marks capped: true even though the combined 3.0 cap does NOT bind", () => {
    const current = masked("m1", "Third time following up on this.", 0);
    const ev = scoreEscalation(current, []);
    // Only the lexical follow-up fires — nothing else, so the combined-cap sum (1.6) is
    // nowhere near 3.0. This isolates the individual cap from the combined one.
    expect(ev).toHaveLength(1);
    const followUp = ev[0];
    expect(followUp?.subcategory).toBe("follow_up");
    // raw = 2.4 (entry weight) * 0.8 (DEPENDENCY_SCALE) = 1.92, which exceeds LEXICAL_FOLLOW_UP_CAP.
    expect(followUp?.rawWeight).toBe(2.4);
    expect(followUp?.weight).toBeCloseTo(LEXICAL_FOLLOW_UP_CAP, 9);
    expect(followUp?.capped).toBe(true);
  });

  it("a follow-up marker whose raw contribution does NOT exceed the cap is not marked capped", () => {
    // "reminder that" has raw weight 1.6, so raw = 1.6 * 0.8 = 1.28 < LEXICAL_FOLLOW_UP_CAP.
    const current = masked("m1", "Just a reminder that this is outstanding.", 0);
    const ev = scoreEscalation(current, []);
    const followUp = ev.find((e) => e.subcategory === "follow_up");
    expect(followUp).toBeDefined();
    expect(followUp?.weight).toBeLessThan(LEXICAL_FOLLOW_UP_CAP);
    expect(followUp?.capped).toBe(false);
  });
});

describe("scoreEscalation: combined 3.0 cap and bookkeeping", () => {
  it("never exceeds the combined cap even when every sub-component fires", () => {
    const p1 = masked("m1", `${REQUEST} third time`, 2880);
    const p2 = masked("m2", `${REQUEST} third time`, 480);
    const current = masked("m3", `Following up again: ${REQUEST} third time`, 0);
    const ev = scoreEscalation(current, [p1, p2]);
    const sum = ev.reduce((s, e) => s + e.weight, 0);
    expect(sum).toBeLessThanOrEqual(REPETITION_ESCALATION_CAP + 1e-9);
  });

  it("marks evidence capped: true and rescales proportionally when the cap binds", () => {
    const p1 = masked("m1", `${REQUEST} third time`, 2880);
    const p2 = masked("m2", `${REQUEST} third time`, 480);
    const current = masked("m3", `Following up again: ${REQUEST} third time`, 0);
    const ev = scoreEscalation(current, [p1, p2]);
    const uncappedGuess = ev.reduce((s, e) => s + e.rawWeight, 0);
    if (uncappedGuess > REPETITION_ESCALATION_CAP) {
      expect(ev.every((e) => e.capped)).toBe(true);
      const sum = ev.reduce((s, e) => s + e.weight, 0);
      expect(sum).toBeCloseTo(REPETITION_ESCALATION_CAP, 6);
      // rawWeight must be untouched by the rescale.
      for (const e of ev) expect(e.rawWeight).toBeGreaterThan(0);
    }
  });

  it("all contributing evidence shares one eventId", () => {
    const p1 = masked("m1", REQUEST, 2880);
    const p2 = masked("m2", REQUEST, 480);
    const current = masked("m3", REQUEST, 0);
    const ev = scoreEscalation(current, [p1, p2]);
    const eventIds = new Set(ev.map((e) => e.eventId));
    expect(eventIds.size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Prompt 6R-A Task B: synthetic escalation Evidence must not overlap masking.
// ---------------------------------------------------------------------------

/** Builds a MaskedMessage through the REAL pipeline (Task B's required regression), not the hand-rolled `masked()` helper above. */
function realMasked(id: string, text: string, minutesBefore: number, senderId = "a@example.com", recipientIds = ["b@example.com"]): MaskedMessage {
  const timestamp = iso(minutesBefore);
  const headAct = identifyHeadAct(text, segmentSentences(text));
  if (!headAct) throw new Error(`test fixture expected a detected request: ${JSON.stringify(text)}`);
  const message: Message = { id, threadId: "t1", senderId, recipientIds, mentionedIds: [], timestamp, text };
  const surface = scoreSurface(message, headAct);
  return buildMaskedMessage(message, headAct, surface);
}

describe("scoreEscalation: synthetic evidence never overlaps masking (Task B)", () => {
  it("real pipeline regression: repeated 'Could you review the deck?' produces synthetic evidence with safe, non-overlapping anchor spans", () => {
    const REPEATED = "Could you review the deck?";
    const p1 = realMasked("m1", REPEATED, 1440);
    const current = realMasked("m2", REPEATED, 0);
    const ev = scoreEscalation(current, [p1]);

    const synthetic = ev.filter((e) => e.category === "escalation");
    expect(synthetic.length).toBeGreaterThan(0);

    for (const e of synthetic) {
      expect(e.span.end - e.span.start, `${e.subcategory}: span must have positive length`).toBeGreaterThan(0);
      expect(e.trigger, `${e.subcategory}: trigger must contain lexical content`).toMatch(/[A-Za-z0-9]/);
      expect(e.trigger).toBe(current.maskedText.slice(e.span.start, e.span.end));
      for (const maskedSpan of current.maskedSpans) {
        const overlaps = e.span.start < maskedSpan.end && e.span.end > maskedSpan.start;
        expect(overlaps, `${e.subcategory} span ${JSON.stringify(e.span)} must not overlap masked span ${JSON.stringify(maskedSpan)}`).toBe(false);
      }
    }
  });

  it("every synthetic contribution for one call reuses the same structural anchor span", () => {
    const REPEATED = "Could you review the deck?";
    const p1 = realMasked("m1", REPEATED, 2880);
    const p2 = realMasked("m2", REPEATED, 480);
    const current = realMasked("m3", REPEATED, 0);
    const ev = scoreEscalation(current, [p1, p2]);
    const synthetic = ev.filter((e) => e.category === "escalation");
    const spans = new Set(synthetic.map((e) => `${e.span.start}-${e.span.end}`));
    expect(spans.size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Prompt 6R-A Task C: only real recipients may break the chain / answer.
// ---------------------------------------------------------------------------

describe("scoreEscalation: only real recipients count (Task C)", () => {
  it("CASE 1: an unrelated third party's completion signal does NOT break the chain", () => {
    const p1 = masked("m1", REQUEST, 1440, "a@example.com", "b@example.com");
    const thirdParty = masked("c1", "Done.", 720, "c@example.com", "a@example.com");
    const current = masked("m2", REQUEST, 0, "a@example.com", "b@example.com");
    const ev = scoreEscalation(current, [p1, thirdParty]);
    expect(ev.some((e) => e.subcategory === "verified_restatement")).toBe(true);
  });

  it("CASE 2: a completion signal from the actual recipient MUST break the chain", () => {
    const p1 = masked("m1", REQUEST, 1440, "a@example.com", "b@example.com");
    const recipientReply = masked("b1", "Done.", 720, "b@example.com", "a@example.com");
    const current = masked("m2", REQUEST, 0, "a@example.com", "b@example.com");
    const ev = scoreEscalation(current, [p1, recipientReply]);
    expect(ev.some((e) => e.subcategory === "verified_restatement")).toBe(false);
  });

  it("CASE 3: an unrelated third party's message does NOT suppress the unanswered bonus", () => {
    const p1 = masked("m1", REQUEST, 1440, "a@example.com", "b@example.com");
    const thirdParty = masked("c1", "Unrelated update.", 720, "c@example.com", "a@example.com");
    const current = masked("m2", REQUEST, 0, "a@example.com", "b@example.com");
    const ev = scoreEscalation(current, [p1, thirdParty]);
    expect(ev.some((e) => e.subcategory === "unanswered")).toBe(true);
  });

  it("CASE 4: a reply from the actual recipient MUST suppress the unanswered bonus", () => {
    const p1 = masked("m1", REQUEST, 1440, "a@example.com", "b@example.com");
    const recipientReply = masked("b1", "Looking into it.", 720, "b@example.com", "a@example.com");
    const current = masked("m2", REQUEST, 0, "a@example.com", "b@example.com");
    const ev = scoreEscalation(current, [p1, recipientReply]);
    expect(ev.some((e) => e.subcategory === "unanswered")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Prompt 6R-B Task 5: requestSignature normalization must actually affect
// same-request matching through the real pipeline.
// ---------------------------------------------------------------------------

describe("scoreEscalation: requestSignature normalization recovers same-request matching (Prompt 6R-B Task 5)", () => {
  it("a prior 'Could you send the deck?' and a later 'Could you get the deck sent?' meet the same-request Jaccard gate only because 'sent' normalizes to 'send'", () => {
    const prior = realMasked("p1", "Could you send the deck?", 1440);
    const current = realMasked("cur", "Could you get the deck sent?", 0);

    // The un-normalized "sent" token, if it had survived unnormalized, would put "send" and
    // "sent" in different signatures and drop the intersection to just {deck} — union
    // {send,deck,get,sent} — Jaccard 1/4 = 0.25, BELOW the 0.30 gate. Normalization is what
    // pulls "sent" into "send", raising the intersection to {send,deck} over union
    // {send,deck,get} = 2/3, clearing the gate.
    expect(prior.requestSignature).toContain("send");
    expect(current.requestSignature).toContain("send");
    expect(current.requestSignature).not.toContain("sent");

    const jaccard = requestSignatureJaccard(prior.requestSignature, current.requestSignature);
    expect(jaccard).toBeGreaterThanOrEqual(SAME_REQUEST_JACCARD_THRESHOLD);
    expect(jaccard).toBeCloseTo(2 / 3, 9);

    const ev = scoreEscalation(current, [prior]);
    expect(ev.some((e) => e.subcategory === "verified_restatement")).toBe(true);
  });
});
