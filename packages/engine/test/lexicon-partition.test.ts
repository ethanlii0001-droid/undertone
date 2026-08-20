/**
 * Must fail if a normalized surface form has a home in both the surface
 * and force lexicons without an explicit, non-overlapping span rule
 * (SPEC.md §17; LEXICON.md §0.3). Enforces the surface/force independence
 * claim (CLAUDE.md rule 3) at the lexicon level.
 *
 * Mechanically enforces the canonical §0.3 collision rulings using
 * explicit exemplars and their required scorer homes, run through the
 * real surface and force scorers end to end — not an attempt to prove
 * regex-language disjointness mathematically (that's undecidable in
 * general and not what §0.3 actually claims; §0.3 is a set of specific,
 * enumerated rulings, so this test checks exactly those).
 */
import { describe, it, expect } from "vitest";
import { segmentSentences } from "../src/segment.js";
import { identifyHeadAct } from "../src/headAct.js";
import { scoreSurface } from "../src/surface/score.js";
import { buildMaskedMessage } from "../src/mask.js";
import { scoreForce } from "../src/force/score.js";
import type { Config, Message } from "../src/types.js";

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

function analyze(text: string) {
  const message = buildMessage(text);
  const headAct = identifyHeadAct(text, segmentSentences(text));
  if (!headAct) throw new Error(`test fixture expected a detected request: ${JSON.stringify(text)}`);
  const surface = scoreSurface(message, headAct);
  const masked = buildMaskedMessage(message, headAct, surface);
  const force = scoreForce(masked, [], CONFIG);
  return { surface, force, masked };
}

describe("lexicon partition: temporal-only (LEXICON.md §0.3)", () => {
  const cases = ["Could you send this ASAP?", "Could you send this now?", "Could you send this immediately?", "Could you send this right away?", "Could you send this first thing tomorrow?"];

  for (const text of cases) {
    it(`${JSON.stringify(text)}: contributes force temporal evidence and zero surface upgrader evidence for the phrase`, () => {
      const { surface, force } = analyze(text);
      expect(force.evidence.some((e) => e.category === "temporal")).toBe(true);
      expect(surface.evidence.some((e) => e.category === "upgrader")).toBe(false);
    });
  }
});

describe("lexicon partition: dependency-only (LEXICON.md §0.3)", () => {
  const cases: Array<[string, string]> = [
    ["Could you fix this? It is blocked on Legal.", "blocked"],
    ["Could you fix this? Legal is the blocker.", "blocker"],
    ["Could you fix this? It is blocking three tasks.", "blocking"],
    ["Could you fix this? It is holding up the release.", "holding up"],
    ["Could you fix this? Legal is waiting on it.", "waiting on"],
  ];

  for (const [text, word] of cases) {
    it(`${JSON.stringify(text)}: "${word}" contributes force dependency evidence and zero surface upgrader evidence`, () => {
      const { surface, force } = analyze(text);
      expect(force.evidence.some((e) => e.category === "dependency")).toBe(true);
      expect(surface.evidence.some((e) => e.category === "upgrader")).toBe(false);
    });
  }
});

describe("lexicon partition: surface-only (LEXICON.md §0.3)", () => {
  it("'critical'/'urgent'/'high priority' are surface upgraders and contribute zero force", () => {
    for (const text of ["Could you review this critical issue?", "Could you review this urgent issue?", "Could you review this high priority issue?"]) {
      const { surface, force } = analyze(text);
      expect(surface.evidence.some((e) => e.category === "upgrader")).toBe(true);
      expect(force.value).toBe(3.0);
    }
  });

  it("'no rush'/'no pressure'/'whenever' are surface downgraders and contribute zero force", () => {
    for (const text of ["Could you review the deck? No rush.", "Could you review the deck, no pressure?", "Could you review the deck whenever?"]) {
      const { surface, force } = analyze(text);
      expect(surface.evidence.some((e) => e.category === "downgrader")).toBe(true);
      expect(force.value).toBe(3.0);
    }
  });
});

describe("lexicon partition: 'just following up' splits into non-overlapping surface/force spans", () => {
  it("'just' is surface, 'following up' is force, and the two spans never overlap", () => {
    const text = "Could you just review the deck? Following up on this.";
    const { surface, force } = analyze(text);
    const justEvidence = surface.evidence.find((e) => e.category === "downgrader" && /just/i.test(e.trigger));
    const followUpEvidence = force.evidence.find((e) => e.category === "dependency" && e.subcategory === "follow_up");
    expect(justEvidence).toBeDefined();
    expect(followUpEvidence).toBeDefined();
    if (justEvidence && followUpEvidence) {
      const overlaps = justEvidence.span.start < followUpEvidence.span.end && justEvidence.span.end > followUpEvidence.span.start;
      expect(overlaps).toBe(false);
    }
  });
});

describe("lexicon partition: no surface/force span ever overlaps in the same message", () => {
  it("across every exemplar above, surface and force evidence spans are always disjoint", () => {
    const texts = [
      "Could you send this ASAP?",
      "Could you fix this? It is blocked on Legal.",
      "Could you review this critical issue? No rush.",
      "Could you just review the deck? Following up on this.",
    ];
    for (const text of texts) {
      const { surface, force } = analyze(text);
      for (const s of surface.evidence) {
        for (const f of force.evidence) {
          if (f.category === "escalation") continue; // synthetic, not a literal span match
          const overlaps = s.span.start < f.span.end && s.span.end > f.span.start;
          expect(overlaps, `${JSON.stringify(text)}: surface ${JSON.stringify(s.trigger)} vs force ${JSON.stringify(f.trigger)}`).toBe(false);
        }
      }
    }
  });
});
