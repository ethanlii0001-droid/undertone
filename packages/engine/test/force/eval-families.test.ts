/**
 * Force-specific EVAL test (Prompt 6 Task 14). Builds a TEST-ONLY
 * mini-pipeline from the already-implemented modules (segmentSentences,
 * identifyHeadAct, scoreSurface, buildMaskedMessage, scoreForce) — this is
 * for module verification only, NOT the public engine pipeline. Public
 * score() stays intentionally unimplemented (Task 16).
 *
 * Runs all 120 core pairs (all six families) and all 10 negative controls
 * through this pipeline, using each fixture's own `expected` object —
 * never one global threshold. Uses EVAL.md's deterministic fixture clock
 * (2026-08-17T09:00:00-04:00, businessDayEnd 17:00), with the same
 * -04:00-offset-preserving `minutesBefore` handling independence.test.ts
 * already established for TestThread fixtures.
 *
 * RESOLVED in Prompt 6R-C (narrow LEXICON.md temporal corrections): ext-07,
 * ext-09, ext-10, ddl-04, ddl-12 — an authoring defect in the date_time
 * "at Npm" entry, plus two narrow surface-form extensions of already-
 * canonical immediate/relative duration concepts ("in N minutes" alongside
 * "within N minutes"; "within the next N hours" alongside "within N
 * hours").
 *
 * RESOLVED in Prompt 6R-E (EVAL.md fixture-wording corrections, no
 * LEXICON.md changes — see that prompt's final report for the exact
 * diffs): ext-01, ext-02, ext-06, ext-08. Each was a fixture using a
 * non-canonical surface form for an already-canonical concept (a bare
 * unqualified weekday, an uncovered dependency verb, "tonight", or an
 * uncovered dependency framing) rather than a genuine lexicon gap; each
 * was corrected to an equivalent canonical construction already present in
 * LEXICON.md, preserving the pair's request wording, scientific
 * comparison, and expected thresholds exactly.
 *
 * All 120 core pairs and all 10 negative controls pass.
 */
import { describe, it, expect } from "vitest";
import { segmentSentences } from "../../src/segment.js";
import { identifyHeadAct } from "../../src/headAct.js";
import { scoreSurface } from "../../src/surface/score.js";
import { buildMaskedMessage } from "../../src/mask.js";
import { scoreForce } from "../../src/force/score.js";
import type { Config, MaskedMessage, Message, Thread } from "../../src/types.js";
import {
  FAMILIES,
  FORCE_MANIPULATION_FAMILIES,
  SURFACE_MANIPULATION_FAMILIES,
  pairsByFamily,
  type ExpectedForceManipulation,
  type ExpectedSurfaceManipulation,
  type TestThread,
} from "../fixtures/core-pairs.js";
import { negativeControls } from "../fixtures/negative-controls.js";

/** EVAL.md's deterministic fixture clock — see independence.test.ts's identical constants. */
const FIXTURE_TIMESTAMP = "2026-08-17T09:00:00-04:00";
const FIXTURE_OFFSET = "-04:00";
const FIXTURE_OFFSET_MINUTES = -4 * 60;
const FIXTURE_CONFIG: Config = { businessDayEnd: "17:00" };

const SENDER_IDS: Record<string, string> = { A: "sender-a@example.com", B: "sender-b@example.com" };
function resolveParticipant(label: string): string {
  return SENDER_IDS[label] ?? `${label.toLowerCase()}@example.com`;
}

function isTestThread(value: string | TestThread): value is TestThread {
  return Array.isArray(value);
}

/** Identical to independence.test.ts's offsetTimestamp — never Date.now()/runtime timezone. */
function offsetTimestamp(minutesBefore: number): string {
  if (minutesBefore === 0) return FIXTURE_TIMESTAMP;
  const baseInstantMs = Date.parse(FIXTURE_TIMESTAMP);
  const shiftedMs = baseInstantMs - minutesBefore * 60_000;
  const wallClock = new Date(shiftedMs + FIXTURE_OFFSET_MINUTES * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${wallClock.getUTCFullYear()}-${pad(wallClock.getUTCMonth() + 1)}-${pad(wallClock.getUTCDate())}T${pad(wallClock.getUTCHours())}:${pad(wallClock.getUTCMinutes())}:${pad(wallClock.getUTCSeconds())}${FIXTURE_OFFSET}`;
}

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

interface Analyzed {
  surface: number;
  force: number;
}

/** Test-only mini-pipeline: scores the LAST message of a thread, using every earlier message as masked prior context (module verification only — not the public engine). */
function analyzeThread(threadId: string, variant: string | TestThread): Analyzed | null {
  const thread = buildThread(threadId, variant);
  const maskedByMessage: MaskedMessage[] = [];
  let lastSurfaceValue = 0;
  for (const message of thread.messages) {
    const headAct = identifyHeadAct(message.text, segmentSentences(message.text));
    if (!headAct) return null;
    const surface = scoreSurface(message, headAct);
    lastSurfaceValue = surface.value;
    maskedByMessage.push(buildMaskedMessage(message, headAct, surface));
  }
  const current = maskedByMessage[maskedByMessage.length - 1] as MaskedMessage;
  const priorMessages = maskedByMessage.slice(0, -1);
  const force = scoreForce(current, priorMessages, FIXTURE_CONFIG);
  return { surface: lastSurfaceValue, force: force.value };
}

describe("force EVAL: fixture integrity", () => {
  it("loads exactly 120 core pairs, 20 per family", () => {
    expect(pairsByFamily("head-act-modality")).toHaveLength(20);
    let total = 0;
    for (const family of FAMILIES) total += pairsByFamily(family).length;
    expect(total).toBe(120);
  });

  it("loads exactly 10 negative controls", () => {
    expect(negativeControls).toHaveLength(10);
  });
});

describe("force EVAL: surface-manipulation families (force must stay within forceDeltaMax)", () => {
  for (const family of SURFACE_MANIPULATION_FAMILIES) {
    describe(family, () => {
      for (const pair of pairsByFamily(family)) {
        const expected = pair.expected as ExpectedSurfaceManipulation;
        it(`${pair.id}: ${expected.claim}`, () => {
          const a = analyzeThread(`${pair.id}-a`, pair.a);
          const b = analyzeThread(`${pair.id}-b`, pair.b);
          expect(a, `${pair.id}: variant a must be a detected request`).not.toBeNull();
          expect(b, `${pair.id}: variant b must be a detected request`).not.toBeNull();
          const forceDelta = Math.abs((a as Analyzed).force - (b as Analyzed).force);
          expect(forceDelta, `${pair.id}: |force(a) - force(b)| <= ${expected.forceDeltaMax}`).toBeLessThanOrEqual(
            expected.forceDeltaMax,
          );
        });
      }
    });
  }
});

describe("force EVAL: force-manipulation families (force relation/delta, surface held within surfaceDeltaMax)", () => {
  for (const family of FORCE_MANIPULATION_FAMILIES) {
    describe(family, () => {
      for (const pair of pairsByFamily(family)) {
        const expected = pair.expected as ExpectedForceManipulation;
        it(`${pair.id}: ${expected.claim}`, () => {
          const a = analyzeThread(`${pair.id}-a`, pair.a);
          const b = analyzeThread(`${pair.id}-b`, pair.b);
          expect(a, `${pair.id}: variant a must be a detected request`).not.toBeNull();
          expect(b, `${pair.id}: variant b must be a detected request`).not.toBeNull();
          const av = a as Analyzed;
          const bv = b as Analyzed;

          const surfaceDelta = Math.abs(av.surface - bv.surface);
          expect(surfaceDelta, `${pair.id}: |surface(a) - surface(b)| <= ${expected.surfaceDeltaMax}`).toBeLessThanOrEqual(
            expected.surfaceDeltaMax,
          );

          const forceDelta = bv.force - av.force;
          if (expected.forceRelation === "a > b") {
            expect(-forceDelta, `${pair.id}: force(a) - force(b) >= ${expected.minForceDelta}`).toBeGreaterThanOrEqual(
              expected.minForceDelta,
            );
          } else {
            expect(forceDelta, `${pair.id}: force(b) - force(a) >= ${expected.minForceDelta}`).toBeGreaterThanOrEqual(
              expected.minForceDelta,
            );
          }
        });
      }
    });
  }
});

describe("force EVAL: negative controls", () => {
  for (const control of negativeControls) {
    it(`${control.id}: force === 3.0 if a request is identified, else suppressed (${control.note})`, () => {
      const headAct = identifyHeadAct(control.message, segmentSentences(control.message));
      if (!headAct) {
        // No reproducible request identified — suppressed/not-applicable (Task 14C). Not manufactured.
        expect(headAct).toBeNull();
        return;
      }
      const message: Message = {
        id: control.id,
        threadId: control.id,
        senderId: resolveParticipant("A"),
        recipientIds: [resolveParticipant("B")],
        mentionedIds: [],
        timestamp: FIXTURE_TIMESTAMP,
        text: control.message,
      };
      const surface = scoreSurface(message, headAct);
      const masked = buildMaskedMessage(message, headAct, surface);
      const force = scoreForce(masked, [], FIXTURE_CONFIG);
      expect(force.value, `${control.id}: force must equal 3.0 when a request is identified`).toBe(3.0);
    });
  }
});
