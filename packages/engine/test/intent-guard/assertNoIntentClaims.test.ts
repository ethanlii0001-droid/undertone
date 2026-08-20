/**
 * Tests for the intent-language guard (src/intent-guard/banned.ts,
 * assertNoIntentClaims.ts) — SPEC.md §13.1's ban on user-facing generated
 * text claiming a sender's intent/knowledge/desire, and the permitted
 * modalized-reader-effect / message-focused alternative style. This guard
 * applies to GENERATED analysis copy, not raw input messages — none of
 * these tests feed anything through headAct/surface/force detection.
 */
import { describe, it, expect } from "vitest";
import { assertNoIntentClaims, findIntentClaim } from "../../src/intent-guard/assertNoIntentClaims.js";

const SAFE_STRINGS = [
  "The wording is at risk of being under-read.",
  "A reader is likely to under-weight this request.",
  "A reader tends to under-weight this request.",
  "The surrounding language carries two independent markers.",
  "Phrased as a hint (2/10). The surrounding language carries 3 independent markers of expected action (temporal, dependency), giving a communicative force of 7/10.",
  "This means the deadline is today.",
  "This is the wanted outcome.",
  "The request tends to read as more forceful than the underlying evidence.",
  "See the reader guide for details.",
];

const UNSAFE_STRINGS = [
  "The sender meant this as urgent.",
  "They really wanted you to do it today.",
  "The sender intended this as an order.",
  "He knew this was overdue.",
  "She believed the deadline had passed.",
  "The sender was trying to avoid seeming pushy.",
  "They wanted you to drop everything.",
  // Prompt 7 Final Cleanup Task 1: the previous 25-character intervening-text cap let these
  // escape — the person subject and mental-state verb are separated by more than 25 characters
  // of ordinary clause material but never cross a strong sentence/clause boundary.
  "The sender, based on the surrounding context, intended this as an order.",
  "The sender, after reviewing the entire thread, believed this was urgent.",
  // Task 2: "is trying to" was previously missed (only "was"/"were trying to" matched).
  "The sender is trying to make this urgent.",
  // Task 3: unmodalized reader-effect claims.
  "A reader under-weights this request.",
  "A reader will under-weight this request.",
  "A reader definitely reads this as optional.",
];

describe("findIntentClaim: SAFE strings never match", () => {
  for (const text of SAFE_STRINGS) {
    it(`passes: ${JSON.stringify(text)}`, () => {
      expect(findIntentClaim(text)).toBeNull();
    });
  }
});

describe("findIntentClaim: UNSAFE strings always match", () => {
  for (const text of UNSAFE_STRINGS) {
    it(`flags: ${JSON.stringify(text)}`, () => {
      expect(findIntentClaim(text)).not.toBeNull();
    });
  }
});

describe("assertNoIntentClaims: throws only for UNSAFE strings", () => {
  for (const text of SAFE_STRINGS) {
    it(`does not throw: ${JSON.stringify(text)}`, () => {
      expect(() => assertNoIntentClaims(text)).not.toThrow();
    });
  }

  for (const text of UNSAFE_STRINGS) {
    it(`throws: ${JSON.stringify(text)}`, () => {
      expect(() => assertNoIntentClaims(text)).toThrow(/banned intent\/reader-effect claim/);
    });
  }
});

describe("assertNoIntentClaims: does not evaluate raw input messages, only generated copy", () => {
  it("a sender's own message containing 'I intended' is never passed to this guard by the scoring pipeline — this module has no Message-shaped input at all", () => {
    // The guard's only exported functions take a plain `string` (generated copy), never a
    // `Message`/`Thread` — there is no code path by which raw sender text reaches this guard.
    expect(typeof assertNoIntentClaims).toBe("function");
    expect(assertNoIntentClaims.length).toBe(1);
  });
});
