/**
 * Regression tests for the 10 hard cases in EVAL.md's "## Hard cases and
 * scope guards" section (mechanically loaded fixture: fixtures/hard-cases.ts
 * -> hard-cases.json), asserting the specific `v1_1_behavior`/`expected`
 * outcome EVAL.md already documents for each one — not a numeric score
 * EVAL.md never specifies (CLAUDE.md rule on inventing behavior).
 *
 * hc-07 is the one exception: its documented `expected` ("supported by span
 * partition") requires detecting a head act with no second-person address
 * and no CCSARP L1-L7 pattern in the clause at all ("the filing can't go
 * out until this is signed" never says "you"). That is exactly the strong-
 * hint (L8) territory CLAUDE.md's "Known gaps" #4 and head-act.test.ts's
 * `it.todo`s already document as unimplemented — headAct.ts's
 * MAX_REPRODUCIBLE_LEVEL caps selection at L7. So hc-07 gets one regular
 * test asserting the CURRENT (conservative, suppress-rather-than-guess)
 * behavior, plus an `it.todo` recording the still-unmet full expectation,
 * matching that file's own convention rather than inventing a passing
 * assertion for behavior that doesn't exist yet.
 */
import { describe, it, expect } from "vitest";
import { score } from "../src/index.js";
import type { Evidence, MessageAnalysis, Thread } from "../src/types.js";
import { PROXIMITY_MAX } from "../src/force/temporal.js";
import { hardCases } from "./fixtures/hard-cases.js";

const CONFIG = { businessDayEnd: "17:00" };
const DEFAULT_TIMESTAMP = "2026-08-17T09:00:00-04:00";

function findCase(id: string) {
  const hc = hardCases.find((c) => c.id === id);
  if (!hc) throw new Error(`hard case fixture missing: ${id}`);
  return hc;
}

/** Builds and scores a single-message thread, mirroring independence.test.ts's fixture-clock convention (EVAL.md's deterministic clock) unless overridden. */
function analyze(
  id: string,
  text: string,
  opts: { recipientIds?: string[]; timestamp?: string } = {},
): MessageAnalysis {
  const thread: Thread = {
    id,
    messages: [
      {
        id: `${id}-m0`,
        threadId: id,
        senderId: "a@example.com",
        recipientIds: opts.recipientIds ?? ["b@example.com"],
        mentionedIds: [],
        timestamp: opts.timestamp ?? DEFAULT_TIMESTAMP,
        text,
      },
    ],
  };
  const result = score(thread, CONFIG);
  const message = result.messages[0];
  if (!message) throw new Error(`score() returned no MessageAnalysis for ${id}`);
  return message;
}

/** No character offset may serve both scorers in the same message (SPEC.md §10.2, CLAUDE.md rule 3). */
function noSpanOverlap(surfaceEvidence: readonly Evidence[], forceEvidence: readonly Evidence[]): boolean {
  return !forceEvidence.some((f) => surfaceEvidence.some((s) => s.span.start < f.span.end && f.span.start < s.span.end));
}

describe("hc-01: sarcasm/irony — out of scope, no invented sarcastic meaning", () => {
  it("suppressed:no_head_act — literal text carries no reproducible CCSARP request pattern, so nothing is scored (SPEC.md §14 sarcasm is out of scope; no intent-like inversion is performed)", () => {
    const hc = findCase("hc-01");
    const a = analyze(hc.id, hc.message);
    expect(a.suppressed).toBe("no_head_act");
    expect(a.surface).toBeNull();
    expect(a.force).toBeNull();
  });
});

describe("hc-02: information-seeking question containing deadline language", () => {
  it("suppressed:no_head_act — the temporal phrase is inside a question about a deadline, not an issued request", () => {
    const hc = findCase("hc-02");
    const a = analyze(hc.id, hc.message);
    expect(a.suppressed).toBe("no_head_act");
  });
});

describe("hc-03: sincere repeated permission to decline", () => {
  it("remains scoreable, carries surface mitigation evidence, and any force evidence present does not overlap a surface span", () => {
    const hc = findCase("hc-03");
    const a = analyze(hc.id, hc.message);
    expect(a.suppressed).toBeUndefined();
    expect(a.surface).not.toBeNull();
    expect(a.surfaceEvidence.some((e) => e.category === "downgrader")).toBe(true);
    expect(noSpanOverlap(a.surfaceEvidence, a.forceEvidence)).toBe(true);
  });
});

describe("hc-04: already-past deadline", () => {
  it("scores, carries already_past temporal evidence, and receives the maximum proximity bonus (SPEC.md §9.3 PROXIMITY_MAX for a resolved past instant)", () => {
    const hc = findCase("hc-04");
    const a = analyze(hc.id, hc.message);
    expect(a.suppressed).toBeUndefined();
    expect(a.surface).not.toBeNull();
    const alreadyPast = a.forceEvidence.find((e) => e.category === "temporal" && e.subcategory === "already_past");
    expect(alreadyPast).toBeDefined();
    const proximity = a.forceEvidence.find((e) => e.category === "temporal" && e.subcategory === "temporal.proximity");
    expect(proximity).toBeDefined();
    expect(proximity?.weight).toBe(PROXIMITY_MAX);
  });
});

describe("hc-05: verbless implicit request", () => {
  it("suppressed:no_head_act — conservative suppression rather than guessing a fragment's intent", () => {
    const hc = findCase("hc-05");
    const a = analyze(hc.id, hc.message);
    expect(a.suppressed).toBe("no_head_act");
  });
});

describe("hc-06: polite and genuinely urgent", () => {
  it("scores with both surface and force non-null and each backed by real Evidence (mitigation caps do not zero out a genuinely urgent request)", () => {
    const hc = findCase("hc-06");
    const a = analyze(hc.id, hc.message);
    expect(a.suppressed).toBeUndefined();
    expect(a.surface).not.toBeNull();
    expect(a.force).not.toBeNull();
    expect(a.surfaceEvidence.length).toBeGreaterThan(0);
    expect(a.forceEvidence.length).toBeGreaterThan(0);
  });
});

describe("hc-07: adjacent mitigation and force evidence", () => {
  it("KNOWN GAP (CLAUDE.md 'Known gaps' #4 / head-act.test.ts's L8 it.todo): current engine suppresses this message as no_head_act rather than detecting a head act, because the clause never addresses a second-person 'you' and matches no CCSARP L1-L7 pattern — the implicit-blockage reading this hard case exercises is strong-hint (L8) territory, which headAct.ts's MAX_REPRODUCIBLE_LEVEL deliberately excludes. This is the documented conservative suppress-rather-than-guess behavior, not a fixture bug.", () => {
    const hc = findCase("hc-07");
    const a = analyze(hc.id, hc.message);
    expect(a.suppressed).toBe("no_head_act");
  });

  it.todo(
    "hc-07 full EVAL.md expectation: request scores; surface consumes the deferral phrase ('if you get a chance'); dynamic 'today' and the filing-blockage dependency remain force events without overlapping surface spans — blocked on L8 strong-hint head-act detection (SPEC.md §6.2, CLAUDE.md Known gaps #4)",
  );
});

describe("hc-08: broadcast request with no resolvable addressee", () => {
  it("KNOWN GAP: 'Can someone take a look...' never reaches the unresolved_addressee guard (index.ts) because it addresses 'someone', not 'you' — no DIRECTNESS pattern matches it, so identifyHeadAct returns null and the message is suppressed as no_head_act before the recipientIds check ever runs. The unresolved_addressee guard itself IS implemented (see hc-08b below) and fires correctly once a head act exists; the gap is that the directness lexicon (LEXICON.md §1, out of scope for this pass) has no 'can/could someone' broadcast-address entry.", () => {
    const hc = findCase("hc-08");
    const a = analyze(hc.id, hc.message, { recipientIds: [] });
    expect(a.suppressed).toBe("no_head_act");
  });

  it.todo(
    "hc-08 full EVAL.md expectation: suppressed:unresolved_addressee for 'Can someone take a look at this before EOD?' — blocked on a 'can/could someone' directness pattern, which is a LEXICON.md change out of scope for this release-hardening pass",
  );

  it("the unresolved_addressee guard itself fires correctly once a head act IS detected with no recipients (regression coverage for index.ts's actual implemented guard, using a 'you'-addressed variant of the same broadcast scenario)", () => {
    const a = analyze("hc-08b", "Can you take a look at this before EOD?", { recipientIds: [] });
    expect(a.suppressed).toBe("unresolved_addressee");
    expect(a.surface).toBeNull();
    expect(a.force).toBeNull();
  });
});

describe("hc-09: quoted request being discussed rather than issued", () => {
  it("suppressed:no_head_act — the quoted request is not scored as the current speaker's own directive (SPEC.md §6.1 quote guard, headAct.ts's isQuotedSpan)", () => {
    const hc = findCase("hc-09");
    const a = analyze(hc.id, hc.message);
    expect(a.suppressed).toBe("no_head_act");
  });
});

describe("hc-10: dynamic same-day timing", () => {
  it("identical text scored at 09:00 and at 16:55 (same businessDayEnd) — the later request gets a strictly stronger proximity contribution", () => {
    const hc = findCase("hc-10");
    const morning = analyze(`${hc.id}-morning`, hc.message, { timestamp: "2026-08-17T09:00:00-04:00" });
    const lateAfternoon = analyze(`${hc.id}-late`, hc.message, { timestamp: "2026-08-17T16:55:00-04:00" });

    expect(morning.suppressed).toBeUndefined();
    expect(lateAfternoon.suppressed).toBeUndefined();

    const morningProximity = morning.forceEvidence.find((e) => e.subcategory === "temporal.proximity");
    const lateProximity = lateAfternoon.forceEvidence.find((e) => e.subcategory === "temporal.proximity");
    expect(morningProximity).toBeDefined();
    expect(lateProximity).toBeDefined();
    expect(lateProximity!.weight).toBeGreaterThan(morningProximity!.weight);

    // The overall force score also moves, not just the isolated proximity component.
    expect(lateAfternoon.force!).toBeGreaterThan(morning.force!);
  });
});
