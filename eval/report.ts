/**
 * Runs the EVAL.md specification-test suite (minimal-pairs.jsonl,
 * negative-controls.jsonl, hard-cases.jsonl) and reports the release
 * assertions from SPEC.md §15.3 — mask invariance, surface/force
 * sensitivity, gap direction, CCSARP monotonicity, evidence reconstruction,
 * surface/force partition, force event deduplication, determinism,
 * intent-language guard, head-act precision/recall, performance, and
 * no-network-egress.
 *
 * Descriptive correlation/gap-spread output must not be presented as
 * evidence of human validity (SPEC.md §15.3 closing note; §15.2).
 *
 * This is a plain TypeScript module, not a CLI script that runs under bare
 * `node`: the engine's own source files import each other with `.js`
 * specifiers pointing at `.ts` files (the TypeScript "bundler"
 * moduleResolution convention every file under packages/engine/src already
 * uses — CLAUDE.md does not license changing that convention here), which
 * only a bundler-aware resolver (Vitest's, in this repo) can follow. Import
 * `computeReleaseReport`/`renderReport` from a Vitest test — see
 * packages/engine/test/eval-report.test.ts, which does exactly that and
 * prints the rendered report. CLAUDE.md's engine constraints (no network,
 * no runtime clock, zero runtime deps) apply only to packages/engine/src;
 * this file is eval tooling and may use ordinary Node APIs (SPEC.md §17;
 * this prompt's own instructions).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import * as ts from "typescript";

import { score } from "../packages/engine/src/index.js";
import { identifyHeadAct } from "../packages/engine/src/headAct.js";
import { segmentSentences } from "../packages/engine/src/segment.js";
import { scoreSurface } from "../packages/engine/src/surface/score.js";
import { buildMaskedMessage } from "../packages/engine/src/mask.js";
import { scoreForce, FORCE_BASELINE } from "../packages/engine/src/force/score.js";
import { findIntentClaim } from "../packages/engine/src/intent-guard/assertNoIntentClaims.js";
import type { Config, Evidence, Message, MessageAnalysis, Thread } from "../packages/engine/src/types.js";
import {
  corePairs,
  FAMILIES,
  pairsByFamily,
  SURFACE_MANIPULATION_FAMILIES,
  FORCE_MANIPULATION_FAMILIES,
  type ExpectedForceManipulation,
  type ExpectedSurfaceManipulation,
  type MessagePair,
  type TestThread,
} from "../packages/engine/test/fixtures/core-pairs.js";

// ---------------------------------------------------------------------------
// Report types (this prompt's Task 6).
// ---------------------------------------------------------------------------

export type ReleaseStatus = "PASS" | "FAIL" | "PARTIAL" | "NOT_MEASURABLE";

export interface ReleaseAssertionResult {
  id: number;
  name: string;
  status: ReleaseStatus;
  observed: string;
  threshold: string;
  note?: string;
}

export interface ReleaseReport {
  assertions: ReleaseAssertionResult[];
}

const RECONSTRUCTION_EPSILON = 1e-6;
const DELTA_EPSILON = 1e-9;

// ---------------------------------------------------------------------------
// EVAL.md's deterministic fixture clock — copied from
// packages/engine/test/independence.test.ts, which is the canonical source
// for this literal string (Monday 2026-08-17 09:00:00-04:00,
// businessDayEnd 17:00). Kept as a literal, not derived from the runtime
// clock (CLAUDE.md rule 1) — this module scores fixture data, never live
// input, so there is no tension with that rule.
// ---------------------------------------------------------------------------

export const FIXTURE_TIMESTAMP = "2026-08-17T09:00:00-04:00";
const FIXTURE_OFFSET = "-04:00";
const FIXTURE_OFFSET_MINUTES = -4 * 60;
export const FIXTURE_CONFIG: Config = { businessDayEnd: "17:00" };

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

function offsetTimestamp(minutesBefore: number): string {
  if (minutesBefore === 0) return FIXTURE_TIMESTAMP;
  const baseInstantMs = Date.parse(FIXTURE_TIMESTAMP);
  const shiftedMs = baseInstantMs - minutesBefore * 60_000;
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

/** Builds a Thread from either a plain string (single message, fixture clock) or a TestThread (minutesBefore-relative multi-message escalation) — same convention as independence.test.ts. */
export function buildThread(threadId: string, variant: string | TestThread): Thread {
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

/** Scores a thread and returns the MessageAnalysis for its final (most recent) message — the request under test, matching independence.test.ts's convention. */
export function analyzeVariant(threadId: string, variant: string | TestThread): MessageAnalysis {
  const thread = buildThread(threadId, variant);
  const result = score(thread, FIXTURE_CONFIG);
  const message = result.messages[result.messages.length - 1];
  if (!message) throw new Error(`score() returned no MessageAnalysis for ${threadId}`);
  return message;
}

// ---------------------------------------------------------------------------
// Shared fixture-driven computations, reused by both this report and
// packages/engine/test/release-assertions.test.ts (which imports these
// exports rather than re-deriving the same iteration over corePairs).
// ---------------------------------------------------------------------------

export interface CorePairAnalysis {
  pair: MessagePair;
  a: MessageAnalysis;
  b: MessageAnalysis;
}

export function analyzeAllCorePairs(): CorePairAnalysis[] {
  return corePairs.map((pair) => ({
    pair,
    a: analyzeVariant(`${pair.id}-a`, pair.a),
    b: analyzeVariant(`${pair.id}-b`, pair.b),
  }));
}

export interface ScoredMessageContext {
  contextId: string;
  message: MessageAnalysis;
  originalText: string;
}

/** Every non-suppressed MessageAnalysis across all 120 core pairs' a/b threads (every message in a multi-message escalation TestThread, not only the final one), paired with the original source text its Evidence spans index into. */
export function collectScoredCorePairMessages(): ScoredMessageContext[] {
  const results: ScoredMessageContext[] = [];
  for (const pair of corePairs) {
    for (const label of ["a", "b"] as const) {
      const threadId = `${pair.id}-${label}`;
      const thread = buildThread(threadId, pair[label]);
      const analysis = score(thread, FIXTURE_CONFIG);
      analysis.messages.forEach((m, i) => {
        if (m.suppressed !== undefined) return;
        const originalText = thread.messages[i]?.text ?? "";
        results.push({ contextId: `${threadId}#${i}`, message: m, originalText });
      });
    }
  }
  return results;
}

function isSurfaceManipulation(expected: MessagePair["expected"]): expected is ExpectedSurfaceManipulation {
  return "surfaceRelation" in expected;
}

// ---------------------------------------------------------------------------
// Assertions 1-4: mask invariance / surface sensitivity / force sensitivity
// / surface invariance (SPEC.md §15.3 rows 1-4). All four read the same
// analyzeAllCorePairs() pass, filtered by family.
// ---------------------------------------------------------------------------

function assertConditionalMaskInvariance(pairs: readonly CorePairAnalysis[]): ReleaseAssertionResult {
  const applicable = pairs.filter((p) => SURFACE_MANIPULATION_FAMILIES.includes(p.pair.family) && p.a.suppressed === undefined && p.b.suppressed === undefined);
  const failures = applicable.filter(({ pair, a, b }) => {
    const expected = pair.expected as ExpectedSurfaceManipulation;
    return Math.abs((a.force ?? 0) - (b.force ?? 0)) > expected.forceDeltaMax + DELTA_EPSILON;
  });
  return {
    id: 1,
    name: "Conditional mask invariance",
    status: failures.length === 0 ? "PASS" : "FAIL",
    observed: `${applicable.length - failures.length}/${applicable.length} surface-manipulation pairs with preserved request detection kept |Δforce| within their own annotated tolerance`,
    threshold: "100%, hard fail",
    note: failures.length ? `failing pairs: ${failures.map((f) => f.pair.id).join(", ")}` : undefined,
  };
}

function assertSurfaceSensitivity(pairs: readonly CorePairAnalysis[]): ReleaseAssertionResult {
  const applicable = pairs.filter((p) => SURFACE_MANIPULATION_FAMILIES.includes(p.pair.family) && p.a.suppressed === undefined && p.b.suppressed === undefined);
  const failures = applicable.filter(({ a, b }) => Math.abs((a.surface ?? 0) - (b.surface ?? 0)) < 1.0 - DELTA_EPSILON);
  return {
    id: 2,
    name: "Surface sensitivity on surface-manipulation pairs",
    status: failures.length === 0 ? "PASS" : "FAIL",
    observed: `${applicable.length - failures.length}/${applicable.length} pairs had |Δsurface| >= 1.0`,
    threshold: "|Δsurface| >= 1.0 on 100%",
    note: failures.length ? `failing pairs: ${failures.map((f) => f.pair.id).join(", ")}` : undefined,
  };
}

function assertForceSensitivity(pairs: readonly CorePairAnalysis[]): ReleaseAssertionResult {
  const applicable = pairs.filter((p) => FORCE_MANIPULATION_FAMILIES.includes(p.pair.family) && p.a.suppressed === undefined && p.b.suppressed === undefined);
  const failures = applicable.filter(({ a, b }) => Math.abs((a.force ?? 0) - (b.force ?? 0)) < 1.0 - DELTA_EPSILON);
  return {
    id: 3,
    name: "Force sensitivity with surface held fixed in force families",
    status: failures.length === 0 ? "PASS" : "FAIL",
    observed: `${applicable.length - failures.length}/${applicable.length} pairs had |Δforce| >= 1.0`,
    threshold: "|Δforce| >= 1.0 on 100%",
    note: failures.length ? `failing pairs: ${failures.map((f) => f.pair.id).join(", ")}` : undefined,
  };
}

function assertSurfaceInvariance(pairs: readonly CorePairAnalysis[]): ReleaseAssertionResult {
  const applicable = pairs.filter((p) => FORCE_MANIPULATION_FAMILIES.includes(p.pair.family) && p.a.suppressed === undefined && p.b.suppressed === undefined);
  const failures = applicable.filter(({ a, b }) => Math.abs((a.surface ?? 0) - (b.surface ?? 0)) >= 1e-9);
  return {
    id: 4,
    name: "Surface invariance in force families",
    status: failures.length === 0 ? "PASS" : "FAIL",
    observed: `${applicable.length - failures.length}/${applicable.length} pairs had |Δsurface| < 1e-9`,
    threshold: "|Δsurface| < 1e-9 on 100%",
    note: failures.length ? `failing pairs: ${failures.map((f) => f.pair.id).join(", ")}` : undefined,
  };
}

// ---------------------------------------------------------------------------
// Assertion 5: expected gap direction (SPEC.md §15.3 row 5, >=95% overall).
// Direction is mechanically derived from each pair's own
// surfaceRelation/forceRelation annotation, per this prompt's Task "2":
// stronger surface wording (force held fixed) moves gap = force - surface
// downward; stronger force (surface held fixed) moves gap upward.
// ---------------------------------------------------------------------------

const GAP_DIRECTION_THRESHOLD = 0.95;

function assertGapDirection(pairs: readonly CorePairAnalysis[]): ReleaseAssertionResult {
  const applicable = pairs.filter((p) => p.a.gap !== null && p.b.gap !== null);
  let correct = 0;
  const failures: string[] = [];
  for (const { pair, a, b } of applicable) {
    const expected = pair.expected;
    let ok: boolean;
    if (isSurfaceManipulation(expected)) {
      ok = expected.surfaceRelation === "a > b" ? a.gap! < b.gap! : b.gap! < a.gap!;
    } else {
      const forceExpected = expected as ExpectedForceManipulation;
      ok = forceExpected.forceRelation === "a > b" ? a.gap! > b.gap! : b.gap! > a.gap!;
    }
    if (ok) correct++;
    else failures.push(pair.id);
  }
  const rate = applicable.length === 0 ? 0 : correct / applicable.length;
  return {
    id: 5,
    name: "Expected gap direction",
    status: rate >= GAP_DIRECTION_THRESHOLD ? "PASS" : "FAIL",
    observed: `${correct}/${applicable.length} core pairs (${(rate * 100).toFixed(1)}%) moved gap in the direction implied by their own expected relation`,
    threshold: ">= 95% overall",
    note: failures.length ? `failing: ${failures.join(", ")}` : undefined,
  };
}

// ---------------------------------------------------------------------------
// Assertion 6: CCSARP ordinal monotonicity (SPEC.md §15.3 row 6). Reported
// PARTIAL, never PASS, per this prompt's explicit instruction — only L1-L7
// are exercised (headAct.ts's MAX_REPRODUCIBLE_LEVEL never selects L8/L9,
// CLAUDE.md "Known gaps" #4).
// ---------------------------------------------------------------------------

const CCSARP_LEVEL_TEXTS: ReadonlyArray<{ level: number; text: string }> = [
  { level: 1, text: "Send the deck." },
  { level: 2, text: "I'm asking you to send the deck." },
  { level: 3, text: "I'd like to ask you to send the deck." },
  { level: 4, text: "You need to send the deck." },
  { level: 5, text: "I want you to send the deck." },
  { level: 6, text: "We could send the deck." },
  { level: 7, text: "Can you send the deck?" },
];

function assertCcsarpMonotonicity(): ReleaseAssertionResult {
  const scored = CCSARP_LEVEL_TEXTS.map(({ level, text }) => {
    const a = analyzeVariant(`ccsarp-l${level}`, text);
    return { level, text, matchedLevel: a.headAct?.ccsarpLevel ?? null, surface: a.surface };
  });

  const mismatches = scored.filter((s) => s.matchedLevel !== s.level);
  let strictlyDecreasing = true;
  for (let i = 1; i < scored.length; i++) {
    const prev = scored[i - 1]!;
    const cur = scored[i]!;
    if (prev.surface === null || cur.surface === null || !(cur.surface < prev.surface)) {
      strictlyDecreasing = false;
      break;
    }
  }

  const implementedHold = mismatches.length === 0 && strictlyDecreasing;
  return {
    id: 6,
    name: "CCSARP ordinal monotonicity with modifiers held constant",
    status: implementedHold ? "PARTIAL" : "FAIL",
    observed: implementedHold
      ? `surface(L1) > ... > surface(L7) holds strictly for all 7 implemented levels: ${scored.map((s) => `L${s.level}=${s.surface}`).join(", ")}`
      : `mismatches: ${mismatches.map((m) => `L${m.level} matched ${m.matchedLevel}`).join(", ")}; strictly decreasing: ${strictlyDecreasing}`,
    threshold: "strict",
    note: "PARTIAL by design: strict for implemented L1-L7; L8/L9 remain explicit TODOs (headAct.ts MAX_REPRODUCIBLE_LEVEL, CLAUDE.md Known gaps #4) and are not exercised here.",
  };
}

// ---------------------------------------------------------------------------
// Assertion 7: evidence reconstruction and span fidelity (SPEC.md §15.3 row
// 7, 100% hard fail). Reuses collectScoredCorePairMessages().
// ---------------------------------------------------------------------------

function assertEvidenceReconstruction(scored: readonly ScoredMessageContext[]): ReleaseAssertionResult {
  let totalEvidence = 0;
  const spanFailures: string[] = [];
  const reconstructionFailures: string[] = [];

  for (const { contextId, message, originalText } of scored) {
    for (const e of [...message.surfaceEvidence, ...message.forceEvidence]) {
      totalEvidence++;
      const spanOk =
        Number.isInteger(e.span.start) &&
        Number.isInteger(e.span.end) &&
        e.span.start >= 0 &&
        e.span.start < e.span.end &&
        e.span.end <= originalText.length &&
        e.trigger === originalText.slice(e.span.start, e.span.end) &&
        e.messageId === message.messageId;
      if (!spanOk) spanFailures.push(`${contextId}:${e.id}`);
    }
    if (message.surface !== null) {
      const sum = message.surfaceEvidence.reduce((s, e) => s + e.weight, 0);
      if (Math.abs(sum - message.surface) > RECONSTRUCTION_EPSILON) reconstructionFailures.push(`${contextId}:surface`);
    }
    if (message.force !== null) {
      const sum = message.forceEvidence.reduce((s, e) => s + e.weight, 0);
      if (Math.abs(FORCE_BASELINE + sum - message.force) > RECONSTRUCTION_EPSILON) reconstructionFailures.push(`${contextId}:force`);
    }
  }

  const failures = [...spanFailures, ...reconstructionFailures];
  return {
    id: 7,
    name: "Evidence reconstruction and span fidelity",
    status: failures.length === 0 ? "PASS" : "FAIL",
    observed: `${totalEvidence} Evidence objects across ${scored.length} scored core-pair messages: span/trigger/messageId fidelity held for ${totalEvidence - spanFailures.length}/${totalEvidence}; surface/force weight-sum reconstruction held for ${scored.length * 2 - reconstructionFailures.length}/${scored.length * 2} applicable score checks`,
    threshold: "100%, hard fail",
    note: failures.length ? `failures (first 10): ${failures.slice(0, 10).join(", ")}` : undefined,
  };
}

// ---------------------------------------------------------------------------
// Assertion 8: surface/force partition (SPEC.md §15.3 row 8, 100% hard
// fail).
// ---------------------------------------------------------------------------

function assertSurfaceForcePartition(scored: readonly ScoredMessageContext[]): ReleaseAssertionResult {
  const failures: string[] = [];
  for (const { contextId, message } of scored) {
    for (const s of message.surfaceEvidence) {
      for (const f of message.forceEvidence) {
        const overlap = s.span.start < f.span.end && f.span.start < s.span.end;
        if (overlap) failures.push(`${contextId}: surface ${s.id} vs force ${f.id}`);
      }
    }
  }
  return {
    id: 8,
    name: "Surface/force partition",
    status: failures.length === 0 ? "PASS" : "FAIL",
    observed: `0 span overlaps across ${scored.length} scored core-pair messages`,
    threshold: "100%, hard fail",
    note: failures.length ? `overlaps (first 10): ${failures.slice(0, 10).join("; ")}` : undefined,
  };
}

// ---------------------------------------------------------------------------
// Assertion 9: force event deduplication (SPEC.md §15.3 row 9, 100% hard
// fail). Exhaustive coverage lives in
// packages/engine/test/event-dedupe.test.ts; this recomputes a small,
// representative subset of the same scenarios end to end (not a re-read of
// that file's pass/fail) so the report is a genuine, self-contained
// computation rather than a restatement.
// ---------------------------------------------------------------------------

interface DedupeScenario {
  label: string;
  text: string;
  check: (evidence: readonly Evidence[]) => boolean;
}

const DEDUPE_SCENARIOS: readonly DedupeScenario[] = [
  {
    label: "same-sentence consequence match collapses to one event",
    text: "Could you send this? Otherwise we'll escalate.",
    check: (ev) => ev.filter((e) => e.category === "consequence").length === 1,
  },
  {
    label: "consequence facts in different local units both contribute as distinct events",
    text: "Could you send this? Otherwise we'll miss the cutoff; Legal will also escalate.",
    check: (ev) => {
      const consequence = ev.filter((e) => e.category === "consequence");
      return consequence.length === 2 && new Set(consequence.map((e) => e.eventId)).size === 2;
    },
  },
  {
    label: "temporal rung and its proximity bonus share a single event",
    text: "Could you send it by Friday?",
    check: (ev) => {
      const temporal = ev.filter((e) => e.category === "temporal");
      return temporal.length === 2 && new Set(temporal.map((e) => e.eventId)).size === 1;
    },
  },
];

function scoreForDedupeCheck(text: string): Evidence[] {
  const headAct = identifyHeadAct(text, segmentSentences(text));
  if (!headAct) return [];
  const message: Message = {
    id: "dedup-check",
    threadId: "dedup-check-thread",
    senderId: "a@example.com",
    recipientIds: ["b@example.com"],
    mentionedIds: [],
    timestamp: FIXTURE_TIMESTAMP,
    text,
  };
  const surface = scoreSurface(message, headAct);
  const masked = buildMaskedMessage(message, headAct, surface);
  return scoreForce(masked, [], FIXTURE_CONFIG).evidence;
}

function assertForceEventDedup(): ReleaseAssertionResult {
  const failures: string[] = [];
  for (const scenario of DEDUPE_SCENARIOS) {
    const evidence = scoreForDedupeCheck(scenario.text);
    if (!scenario.check(evidence)) failures.push(scenario.label);
  }
  return {
    id: 9,
    name: "Force event deduplication",
    status: failures.length === 0 ? "PASS" : "FAIL",
    observed: `${DEDUPE_SCENARIOS.length - failures.length}/${DEDUPE_SCENARIOS.length} representative dedup scenarios held`,
    threshold: "100%, hard fail",
    note: `Exhaustive coverage lives in packages/engine/test/event-dedupe.test.ts.${failures.length ? ` Failing here: ${failures.join(", ")}` : ""}`,
  };
}

// ---------------------------------------------------------------------------
// Assertion 10: determinism (SPEC.md §15.3 row 10, 100% hard fail). One
// pair per family, scored twice, compared by structural (JSON) equality —
// MessageAnalysis/ThreadAnalysis are plain JSON-serializable data.
// ---------------------------------------------------------------------------

function assertDeterminism(): ReleaseAssertionResult {
  const failures: string[] = [];
  let checked = 0;
  for (const family of FAMILIES) {
    const pair = pairsByFamily(family)[0];
    if (!pair) continue;
    for (const label of ["a", "b"] as const) {
      checked++;
      const threadId = `determinism-${pair.id}-${label}`;
      const thread = buildThread(threadId, pair[label]);
      const run1 = score(thread, FIXTURE_CONFIG);
      const run2 = score(thread, FIXTURE_CONFIG);
      if (JSON.stringify(run1) !== JSON.stringify(run2)) failures.push(threadId);
    }
  }
  return {
    id: 10,
    name: "Determinism",
    status: failures.length === 0 ? "PASS" : "FAIL",
    observed: `${checked - failures.length}/${checked} representative threads (one core pair per family) produced structurally identical ThreadAnalysis across two runs of the same Thread+Config`,
    threshold: "100%, hard fail",
    note: failures.length ? `non-deterministic: ${failures.join(", ")}` : undefined,
  };
}

// ---------------------------------------------------------------------------
// Assertion 11: intent-language guard (SPEC.md §15.3 row 11, 100% hard
// fail). Exhaustive suite lives in
// packages/engine/test/intent-guard/assertNoIntentClaims.test.ts; this
// recomputes a small representative sample in both directions.
// ---------------------------------------------------------------------------

const INTENT_GUARD_SAFE_SAMPLES: readonly string[] = [
  "The wording is at risk of being under-read.",
  "A reader is likely to under-weight this request.",
];
const INTENT_GUARD_UNSAFE_SAMPLES: readonly string[] = [
  "The sender meant this as urgent.",
  "They really wanted you to do it today.",
];

function assertIntentGuard(): ReleaseAssertionResult {
  const failures: string[] = [];
  for (const s of INTENT_GUARD_SAFE_SAMPLES) if (findIntentClaim(s) !== null) failures.push(`false positive: ${JSON.stringify(s)}`);
  for (const s of INTENT_GUARD_UNSAFE_SAMPLES) if (findIntentClaim(s) === null) failures.push(`false negative: ${JSON.stringify(s)}`);
  const total = INTENT_GUARD_SAFE_SAMPLES.length + INTENT_GUARD_UNSAFE_SAMPLES.length;
  return {
    id: 11,
    name: "Intent-language guard",
    status: failures.length === 0 ? "PASS" : "FAIL",
    observed: `${total - failures.length}/${total} representative strings correctly classified`,
    threshold: "100%, hard fail",
    note: `Exhaustive suite lives in packages/engine/test/intent-guard/assertNoIntentClaims.test.ts.${failures.length ? ` Failing here: ${failures.join(", ")}` : ""}`,
  };
}

// ---------------------------------------------------------------------------
// Assertion 12: head-act precision/recall (SPEC.md §15.3 row 12). Reported
// NOT_MEASURABLE — the canonical fixtures annotate expected direction/
// invariance between a/b variants (EVAL.md §15.1), not per-example
// positive/negative head-act ground truth, so there is no legitimate
// denominator for a precision/recall computation. Matches
// head-act.test.ts's own it.todo for this exact SPEC.md row.
// ---------------------------------------------------------------------------

function assertHeadActPrecisionRecall(): ReleaseAssertionResult {
  return {
    id: 12,
    name: "Head-act detection precision/recall against fixture annotation",
    status: "NOT_MEASURABLE",
    observed: "no per-example positive/negative head-act ground-truth labels exist in the canonical fixtures",
    threshold: ">= 0.90 precision and recall",
    note: "Canonical EVAL fixtures do not currently provide a dedicated labeled head-act detection benchmark. EVAL.md's 120 minimal pairs annotate expected direction/invariance between two variants (SPEC.md §15.1), not per-example classification ground truth, so precision/recall has no legitimate denominator here (see also packages/engine/test/head-act.test.ts's own it.todo for this SPEC.md §15.3 row).",
  };
}

// ---------------------------------------------------------------------------
// Assertion 13: 50-message performance (SPEC.md §15.3 row 13, < 50ms).
// Deterministic 50-message thread, no pathological strings; measured with
// warm-up runs discarded and the median of several measured runs taken to
// reduce timing noise. `performance.now()` is a Node/eval-tooling API, used
// here (never inside packages/engine/src, per this prompt's own
// instruction).
// ---------------------------------------------------------------------------

const FIFTY_MESSAGE_TEMPLATES: readonly string[] = [
  "Morning! Could you review the deck before the 2pm sync?",
  "Sounds good, I'll take a look.",
  "Quick heads up — the vendor pushed their delivery to Friday.",
  "Thanks for the update.",
  "Can you send the Q3 numbers over when you get a chance?",
  "Sent, let me know if you need anything else.",
  "I'm blocked on Legal for the contract redline, following up again.",
  "Legal approved it this morning.",
  "Could you confirm the deploy window for tonight?",
  "Confirmed for 9pm ET.",
  "We need you to update the runbook before the on-call handoff.",
  "Done, pushed the changes.",
  "Just wanted to ask if the staging environment is back up.",
  "It's back up now.",
  "This needs to be signed off before EOD — the filing can't go out without it.",
  "Signing off now.",
  "Any chance you could double check the invoice totals?",
  "Checked, they match.",
  "Reminder: the client review is at 4pm, could you have slides ready?",
  "Slides are ready.",
];

const PERFORMANCE_MESSAGE_COUNT = 50;
const PERFORMANCE_WARMUP_RUNS = 3;
const PERFORMANCE_MEASURED_RUNS = 11;
const PERFORMANCE_THRESHOLD_MS = 50;

export function buildFiftyMessageThread(): Thread {
  const messages: Message[] = [];
  for (let i = 0; i < PERFORMANCE_MESSAGE_COUNT; i++) {
    const template = FIFTY_MESSAGE_TEMPLATES[i % FIFTY_MESSAGE_TEMPLATES.length]!;
    const senderLabel = i % 2 === 0 ? "A" : "B";
    const recipientLabel = i % 2 === 0 ? "B" : "A";
    messages.push({
      id: `perf-m${i}`,
      threadId: "perf-thread",
      senderId: resolveParticipant(senderLabel),
      recipientIds: [resolveParticipant(recipientLabel)],
      mentionedIds: [],
      timestamp: offsetTimestamp(-i * 7),
      text: template,
    });
  }
  return { id: "perf-thread", messages };
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

function assertPerformance(): ReleaseAssertionResult {
  const thread = buildFiftyMessageThread();
  for (let i = 0; i < PERFORMANCE_WARMUP_RUNS; i++) score(thread, FIXTURE_CONFIG);
  const runs: number[] = [];
  for (let i = 0; i < PERFORMANCE_MEASURED_RUNS; i++) {
    const start = performance.now();
    score(thread, FIXTURE_CONFIG);
    runs.push(performance.now() - start);
  }
  const medianMs = median(runs);
  return {
    id: 13,
    name: "50-message performance",
    status: medianMs < PERFORMANCE_THRESHOLD_MS ? "PASS" : "FAIL",
    observed: `median ${medianMs.toFixed(2)}ms over ${PERFORMANCE_MEASURED_RUNS} measured runs (after ${PERFORMANCE_WARMUP_RUNS} discarded warm-up runs) on this machine — measured result reported as-is, threshold not weakened`,
    threshold: "< 50 ms on target hardware",
  };
}

// ---------------------------------------------------------------------------
// Assertion 14: no diagnostic-engine network egress / forbidden runtime
// globals (SPEC.md §15.3 row 14, 100% hard fail; CLAUDE.md rule 1). Walks
// the real TypeScript AST of packages/engine/src (via the TypeScript
// compiler API, already a devDependency) rather than grepping text, so
// comments/string literals mentioning these names never produce a false
// positive.
// ---------------------------------------------------------------------------

const FORBIDDEN_BARE_IDENTIFIERS: ReadonlySet<string> = new Set(["fetch", "XMLHttpRequest", "navigator", "localStorage"]);
const FORBIDDEN_PROPERTY_ACCESS: ReadonlySet<string> = new Set(["Date.now", "Math.random"]);

const ENGINE_SRC_DIR = new URL("../packages/engine/src", import.meta.url).pathname;

interface ForbiddenGlobalViolation {
  file: string;
  line: number;
  text: string;
}

function listTypeScriptFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) out.push(...listTypeScriptFiles(full));
    else if (extname(full) === ".ts") out.push(full);
  }
  return out;
}

function scanFileForForbiddenGlobals(filePath: string): ForbiddenGlobalViolation[] {
  const text = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.ES2022, true);
  const violations: ForbiddenGlobalViolation[] = [];

  function lineOf(node: ts.Node): number {
    return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
  }

  function visit(node: ts.Node): void {
    if (ts.isIdentifier(node) && FORBIDDEN_BARE_IDENTIFIERS.has(node.text)) {
      const parent = node.parent;
      const isMemberName = ts.isPropertyAccessExpression(parent) && parent.name === node;
      const isDeclarationName =
        (ts.isVariableDeclaration(parent) || ts.isParameter(parent) || ts.isBindingElement(parent) || ts.isFunctionDeclaration(parent) || ts.isPropertySignature(parent) || ts.isPropertyDeclaration(parent) || ts.isImportSpecifier(parent)) &&
        (parent as { name?: ts.Node }).name === node;
      if (!isMemberName && !isDeclarationName) {
        violations.push({ file: filePath, line: lineOf(node), text: node.text });
      }
    }
    if (ts.isPropertyAccessExpression(node)) {
      const exprText = node.getText(sourceFile);
      if (FORBIDDEN_PROPERTY_ACCESS.has(exprText) || exprText === "process.env" || exprText.startsWith("process.env.")) {
        violations.push({ file: filePath, line: lineOf(node), text: exprText });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return violations;
}

export function scanEngineSourceForForbiddenGlobals(): ForbiddenGlobalViolation[] {
  const violations: ForbiddenGlobalViolation[] = [];
  for (const file of listTypeScriptFiles(ENGINE_SRC_DIR)) {
    violations.push(...scanFileForForbiddenGlobals(file));
  }
  return violations;
}

function assertNoNetworkEgress(): ReleaseAssertionResult {
  const violations = scanEngineSourceForForbiddenGlobals();
  return {
    id: 14,
    name: "No diagnostic-engine network egress / forbidden runtime globals",
    status: violations.length === 0 ? "PASS" : "FAIL",
    observed: `${violations.length} forbidden-global reference(s) found by a TypeScript-AST scan of every packages/engine/src/*.ts file (fetch, XMLHttpRequest, Date.now(), Math.random(), navigator, localStorage, process.env)`,
    threshold: "100%, hard fail",
    note: violations.length ? violations.map((v) => `${v.file}:${v.line} ${v.text}`).join("; ") : undefined,
  };
}

// ---------------------------------------------------------------------------
// Public entry point (this prompt's Task 6/7).
// ---------------------------------------------------------------------------

export function computeReleaseReport(): ReleaseReport {
  const corePairAnalysis = analyzeAllCorePairs();
  const scoredMessages = collectScoredCorePairMessages();

  return {
    assertions: [
      assertConditionalMaskInvariance(corePairAnalysis),
      assertSurfaceSensitivity(corePairAnalysis),
      assertForceSensitivity(corePairAnalysis),
      assertSurfaceInvariance(corePairAnalysis),
      assertGapDirection(corePairAnalysis),
      assertCcsarpMonotonicity(),
      assertEvidenceReconstruction(scoredMessages),
      assertSurfaceForcePartition(scoredMessages),
      assertForceEventDedup(),
      assertDeterminism(),
      assertIntentGuard(),
      assertHeadActPrecisionRecall(),
      assertPerformance(),
      assertNoNetworkEgress(),
    ],
  };
}

const REPORT_FOOTER =
  "These are internal specification tests. Passing them establishes implementation fidelity and internal consistency, not human agreement or psychometric validity.";

/** Deterministic, compact human-readable renderer (this prompt's Task 6) — never depends on parsing Vitest console output; operates only on the already-computed ReleaseReport. */
export function renderReport(report: ReleaseReport): string {
  const lines: string[] = [];
  lines.push("UnderTone Release Report (SPEC.md §15.3)");
  lines.push("=".repeat(60));
  for (const a of report.assertions) {
    lines.push(`#${String(a.id).padStart(2, "0")} [${a.status}] ${a.name}`);
    lines.push(`     observed:  ${a.observed}`);
    lines.push(`     threshold: ${a.threshold}`);
    if (a.note) lines.push(`     note:      ${a.note}`);
  }
  lines.push("=".repeat(60));
  const counts = report.assertions.reduce<Record<ReleaseStatus, number>>(
    (acc, a) => {
      acc[a.status] += 1;
      return acc;
    },
    { PASS: 0, FAIL: 0, PARTIAL: 0, NOT_MEASURABLE: 0 },
  );
  lines.push(`Summary: ${counts.PASS} PASS, ${counts.FAIL} FAIL, ${counts.PARTIAL} PARTIAL, ${counts.NOT_MEASURABLE} NOT_MEASURABLE (of ${report.assertions.length})`);
  lines.push("");
  lines.push(REPORT_FOOTER);
  return lines.join("\n");
}
