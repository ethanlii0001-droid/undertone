/**
 * Must fail if one underlying force event (deadline, blockage, consequence,
 * accountability commitment, or repetition) contributes to the force score
 * more than once outside an explicit component rule (SPEC.md §11; §17).
 *
 * Tests force/dedupe.ts's rules directly, and through scoreForce end to
 * end, per this prompt's Task 11.
 */
import { describe, it, expect } from "vitest";
import { segmentSentences } from "../src/segment.js";
import { identifyHeadAct } from "../src/headAct.js";
import { scoreSurface } from "../src/surface/score.js";
import { buildMaskedMessage } from "../src/mask.js";
import { scoreForce, FORCE_BASELINE } from "../src/force/score.js";
import { CONSEQUENCE, CONSEQUENCE_SCALE } from "../src/lexicons/consequence.js";
import { collectForceMatches, dedupeSameEvent, sentenceIndexOf, splitIntoLocalEventUnits, localEventUnitKeyOf } from "../src/force/dedupe.js";
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

function score(text: string) {
  const message = buildMessage(text);
  const headAct = identifyHeadAct(text, segmentSentences(text));
  if (!headAct) throw new Error(`test fixture expected a detected request: ${JSON.stringify(text)}`);
  const surface = scoreSurface(message, headAct);
  const masked = buildMaskedMessage(message, headAct, surface);
  const force = scoreForce(masked, [], CONFIG);
  return { force, masked };
}

describe("force event dedupe: same overlapping consequence event", () => {
  it("'Otherwise we'll escalate.' does not receive two full consequence events from 'otherwise' + 'escalate'", () => {
    const { force } = score("Could you send this? Otherwise we'll escalate.");
    const consequenceEvidence = force.evidence.filter((e) => e.category === "consequence");
    expect(consequenceEvidence).toHaveLength(1);
    expect(consequenceEvidence[0]?.subcategory).toBe("sanction");
    // 3.0 (escalate) * 0.83, not (2.0 otherwise + 3.0 escalate) * 0.83.
    expect(force.value).toBeCloseTo(FORCE_BASELINE + 3.0 * CONSEQUENCE_SCALE, 9);
  });

  it("dedupeSameEvent directly: two same-sentence consequence matches collapse to the strongest", () => {
    const maskedText = "Otherwise we will escalate.";
    const raw = collectForceMatches(CONSEQUENCE, maskedText, CONSEQUENCE_SCALE);
    expect(raw.length).toBeGreaterThanOrEqual(2); // "otherwise" and "escalate" both match
    const deduped = dedupeSameEvent(raw, (m) => `sentence:${sentenceIndexOf(maskedText, m.span.start)}`);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.entry.subcategory).toBe("sanction");
  });
});

describe("force event dedupe: blockage contributes once", () => {
  it("one textual blockage event contributes exactly one dependency Evidence", () => {
    const { force } = score("Could you fix this? It is blocked on Legal, which is the blocker.");
    const dependencyEvidence = force.evidence.filter((e) => e.category === "dependency" && e.subcategory === "framing");
    expect(dependencyEvidence).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Prompt 6R-D: local event units — a finer same-event grouping key than
// whole-sentence identity.
// ---------------------------------------------------------------------------

describe("force event dedupe: local event units (Prompt 6R-D Task 1)", () => {
  it("splitIntoLocalEventUnits: splits at a semicolon", () => {
    const units = splitIntoLocalEventUnits("Otherwise we'll miss the cutoff; Legal will also escalate.");
    expect(units).toHaveLength(2);
  });

  it("splitIntoLocalEventUnits: splits at an em dash", () => {
    const units = splitIntoLocalEventUnits("The client is asking — Legal is also blocked on this.");
    expect(units).toHaveLength(2);
  });

  it("splitIntoLocalEventUnits: does NOT split a bare list conjunction ('review, edit, and format the document' stays one unit)", () => {
    const units = splitIntoLocalEventUnits("Could you review, edit, and format the document?");
    expect(units).toHaveLength(1);
  });

  it("splitIntoLocalEventUnits: DOES split a comma + coordinating conjunction that introduces a new subject", () => {
    const units = splitIntoLocalEventUnits("The client is asking, and my boss is asking.");
    expect(units).toHaveLength(2);
  });

  it("localEventUnitKeyOf: two positions in the same local unit share a key; different units differ", () => {
    const text = "Otherwise we'll miss the cutoff; Legal will also escalate.";
    const keyBeforeSemicolon = localEventUnitKeyOf(text, 5);
    const keyAlsoBeforeSemicolon = localEventUnitKeyOf(text, 20);
    const keyAfterSemicolon = localEventUnitKeyOf(text, text.indexOf("Legal"));
    expect(keyBeforeSemicolon).toBe(keyAlsoBeforeSemicolon);
    expect(keyBeforeSemicolon).not.toBe(keyAfterSemicolon);
  });
});

describe("force event dedupe: two independent consequence facts in ONE sentence (Prompt 6R-D Task 2)", () => {
  it("'Otherwise we'll miss the cutoff; Legal will also escalate.' — both consequence facts contribute, in different local units", () => {
    const { force } = score("Could you send this? Otherwise we'll miss the cutoff; Legal will also escalate.");
    const consequenceEvidence = force.evidence.filter((e) => e.category === "consequence");
    expect(consequenceEvidence).toHaveLength(2);
    expect(consequenceEvidence.some((e) => /miss the cutoff/i.test(e.trigger))).toBe(true);
    expect(consequenceEvidence.some((e) => /escalate/i.test(e.trigger))).toBe(true);
    const eventIds = new Set(consequenceEvidence.map((e) => e.eventId));
    expect(eventIds.size).toBe(2);
    // Both contribute in full — not deduped to a single strongest value.
    const expectedSum = (2.8 + 3.0) * CONSEQUENCE_SCALE; // "miss the cutoff" (sanction) + "escalate" (sanction)
    expect(force.value).toBeCloseTo(FORCE_BASELINE + expectedSum, 6);
  });

  it("the ORIGINAL same-event behavior is preserved when there is no clause boundary: 'Otherwise we'll escalate.' still collapses to one event", () => {
    const { force } = score("Could you send this? Otherwise we'll escalate.");
    const consequenceEvidence = force.evidence.filter((e) => e.category === "consequence");
    expect(consequenceEvidence).toHaveLength(1);
    expect(consequenceEvidence[0]?.subcategory).toBe("sanction");
  });
});

describe("force event dedupe: two independent dependency/accountability facts in ONE sentence (Prompt 6R-D Task 3)", () => {
  it("'The client is asking; my boss is asking.' — both accountability facts contribute, in different local units", () => {
    const { force } = score("Could you send it? The client is asking; my boss is asking.");
    const accountabilityEvidence = force.evidence.filter((e) => e.category === "dependency" && e.subcategory === "accountability");
    expect(accountabilityEvidence).toHaveLength(2);
    const eventIds = new Set(accountabilityEvidence.map((e) => e.eventId));
    expect(eventIds.size).toBe(2);
  });

  it("the ORIGINAL same-event behavior is preserved when there is no clause boundary: a redundant same-unit restatement still collapses to one event", () => {
    const { force } = score("Could you fix this? It is blocked on Legal and Legal is the blocker.");
    const dependencyEvidence = force.evidence.filter((e) => e.category === "dependency" && e.subcategory === "framing");
    expect(dependencyEvidence).toHaveLength(1);
  });
});

describe("force event dedupe: temporal rung + proximity are an explicit subcomponent exception", () => {
  it("both the rung Evidence and the temporal.proximity Evidence contribute, sharing one eventId", () => {
    const { force } = score("Could you send it by Friday?");
    const temporalEvidence = force.evidence.filter((e) => e.category === "temporal");
    expect(temporalEvidence).toHaveLength(2);
    const eventIds = new Set(temporalEvidence.map((e) => e.eventId));
    expect(eventIds.size).toBe(1);
    expect(temporalEvidence.every((e) => e.weight > 0 || e.subcategory === "temporal.proximity")).toBe(true);
    const sum = temporalEvidence.reduce((s, e) => s + e.weight, 0);
    expect(sum).toBeGreaterThan(temporalEvidence[0]!.weight); // proximity genuinely adds on top, not deduped away
  });
});

describe("force event dedupe: independent facts both contribute", () => {
  it("a real deadline plus a genuinely separate dependency both add to force", () => {
    const deadlineOnly = score("Could you send it by Friday?").force.value;
    const dependencyOnly = score("Could you fix this? It is blocked on Legal.").force.value;
    const both = score("Could you send it by Friday? It is blocked on Legal.").force.value;
    expect(both).toBeGreaterThan(deadlineOnly);
    expect(both).toBeGreaterThan(dependencyOnly);
    expect(both).toBeCloseTo(deadlineOnly + dependencyOnly - FORCE_BASELINE, 6);
  });
});

describe("force event dedupe: repetition shares the combined 3.0 cap", () => {
  it("lexical follow-up and verified thread repetition share one eventId and one capped component", () => {
    const priorHeadAct = identifyHeadAct("Could you review the deck?", segmentSentences("Could you review the deck?"));
    if (!priorHeadAct) throw new Error("expected head act");
    const priorMessage: Message = {
      id: "p1",
      threadId: "t1",
      senderId: "a@example.com",
      recipientIds: ["b@example.com"],
      mentionedIds: [],
      timestamp: "2026-08-16T09:00:00-04:00",
      text: "Could you review the deck?",
    };
    const priorSurface = scoreSurface(priorMessage, priorHeadAct);
    const priorMasked = buildMaskedMessage(priorMessage, priorHeadAct, priorSurface);

    const text = "Following up: could you review the deck?";
    const message = buildMessage(text);
    const headAct = identifyHeadAct(text, segmentSentences(text));
    if (!headAct) throw new Error("expected head act");
    const surface = scoreSurface(message, headAct);
    const masked = buildMaskedMessage(message, headAct, surface);
    const force = scoreForce(masked, [priorMasked], CONFIG);

    const escalationRelated = force.evidence.filter((e) => e.category === "escalation" || (e.category === "dependency" && e.subcategory === "follow_up"));
    expect(escalationRelated.length).toBeGreaterThanOrEqual(2);
    const eventIds = new Set(escalationRelated.map((e) => e.eventId));
    expect(eventIds.size).toBe(1);
    const sum = escalationRelated.reduce((s, e) => s + e.weight, 0);
    expect(sum).toBeLessThanOrEqual(3.0 + 1e-9);
  });
});
