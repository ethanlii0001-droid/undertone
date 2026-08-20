/**
 * Tests for buildMaskedMessage (src/mask.ts) — SPEC.md §10's masking and
 * partition invariant, and the requestSignature algorithm (SPEC.md
 * §11.4).
 */
import { describe, it, expect } from "vitest";
import { segmentSentences } from "../src/segment.js";
import { identifyHeadAct } from "../src/headAct.js";
import { scoreSurface } from "../src/surface/score.js";
import { buildContextMaskedMessage, buildMaskedMessage, normalizeActionToken } from "../src/mask.js";
import type { Message } from "../src/types.js";

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

function mask(text: string) {
  const message = buildMessage(text);
  const headAct = identifyHeadAct(text, segmentSentences(text));
  if (!headAct) throw new Error(`test fixture expected a detected request: ${JSON.stringify(text)}`);
  const surface = scoreSurface(message, headAct);
  return { message, headAct, surface, masked: buildMaskedMessage(message, headAct, surface) };
}

describe("buildMaskedMessage: length and offset preservation (SPEC.md §10)", () => {
  it("preserves exact string length", () => {
    const text = "Could you just send this by 5? No rush.";
    const { masked } = mask(text);
    expect(masked.maskedText.length).toBe(text.length);
  });

  it("preserves all original UTF-16 offsets outside masked spans", () => {
    const text = "Could you just send this by 5? No rush.";
    const { masked } = mask(text);
    for (let i = 0; i < text.length; i++) {
      const inMaskedSpan = masked.maskedSpans.some((s) => i >= s.start && i < s.end);
      if (!inMaskedSpan) expect(masked.maskedText[i]).toBe(text[i]);
    }
  });

  it("never deletes or inserts characters — only replaces with spaces", () => {
    const text = "Could you review the deck before Thursday?";
    const { masked } = mask(text);
    const rebuilt = masked.maskedText.replace(/ /g, "#");
    const original = text.replace(/ /g, "#");
    // Every non-space character position in maskedText must equal the same-position original character.
    for (let i = 0; i < text.length; i++) {
      if (masked.maskedText[i] !== " ") expect(masked.maskedText[i]).toBe(text[i]);
    }
    expect(rebuilt.length).toBe(original.length);
  });

  it("preserves structural line-break characters within a masked span", () => {
    const text = "Could you\nreview the deck?";
    const { masked } = mask(text);
    expect(masked.maskedText).toContain("\n");
    expect(masked.maskedText.length).toBe(text.length);
  });
});

describe("buildMaskedMessage: what gets masked (SPEC.md §10)", () => {
  it("masks the directness match span (the head act's own modal/mood realization)", () => {
    const text = "Could you review the deck?";
    const { masked } = mask(text);
    expect(masked.maskedText.slice(0, 9)).toBe("         "); // "Could you" -> spaces
    expect(masked.maskedText).toContain("review the deck");
  });

  it("masks non-absorbed downgrader/upgrader spans", () => {
    const text = "Could you just urgently review the deck?";
    const { masked, surface } = mask(text);
    const modifierEvidence = surface.evidence.filter((e) => e.category !== "directness");
    expect(modifierEvidence.length).toBeGreaterThan(0);
    for (const e of modifierEvidence) {
      expect(masked.maskedText.slice(e.span.start, e.span.end)).toBe(" ".repeat(e.span.end - e.span.start));
    }
  });

  it("does not mask independent force-bearing material outside surface evidence spans", () => {
    const text = "Could you send it by Friday?";
    const { masked } = mask(text);
    expect(masked.maskedText).toContain("by Friday");
  });

  it("masks reproducibly-identified quoted material", () => {
    const text = 'Alex wrote, "Could you send the figures by Friday?" Anyway, could you review the deck?';
    const { masked } = mask(text);
    expect(masked.maskedText).not.toContain("figures");
    expect(masked.maskedText).toContain("review the deck");
  });
});

describe("buildMaskedMessage: requestClauseSpan is structural only (SPEC.md §10)", () => {
  it("equals headAct.span exactly, with no strategy/mood label attached", () => {
    const text = "Could you review the deck?";
    const { masked, headAct } = mask(text);
    expect(masked.requestClauseSpan).toEqual(headAct.span);
    expect(Object.keys(masked.requestClauseSpan).sort()).toEqual(["end", "start"]);
  });
});

describe("buildMaskedMessage: requestSignature (SPEC.md §11.4)", () => {
  it("converges on the same core signature across imperative / ability-question / want-statement realizations", () => {
    const a = mask("Send the deck.").masked.requestSignature;
    const b = mask("Could you send the deck?").masked.requestSignature;
    const c = mask("I'd like you to send the deck.").masked.requestSignature;
    expect([...a].sort()).toEqual(["deck", "send"]);
    expect([...b].sort()).toEqual(["deck", "send"]);
    expect([...c].sort()).toEqual(["deck", "send"]);
  });

  it("contains no CCSARP level, surface score, modal/mood marker, or surface modifier", () => {
    const { masked } = mask("Could you just possibly send the deck?");
    for (const token of masked.requestSignature) {
      expect(token).not.toMatch(/could|would|should|just|possibly|please/i);
    }
  });

  it("is lowercased", () => {
    const { masked } = mask("Send the Deck.");
    for (const token of masked.requestSignature) {
      expect(token).toBe(token.toLowerCase());
    }
  });

  it("excludes stopwords/punctuation", () => {
    const { masked } = mask("Could you send the deck to the client?");
    expect(masked.requestSignature).not.toContain("the");
    expect(masked.requestSignature).not.toContain("to");
  });
});

// ---------------------------------------------------------------------------
// Prompt 6R-A/6R-B: normalizeActionToken — direct unit tests.
// ---------------------------------------------------------------------------

describe("normalizeActionToken: inflection normalization (Prompt 6R-B Task 4C)", () => {
  const INFLECTIONS: Record<string, string> = {
    reviews: "review",
    reviewed: "review",
    reviewing: "review",
    sends: "send",
    sent: "send",
    sending: "send",
    submits: "submit",
    submitted: "submit",
    submitting: "submit",
    updates: "update",
    updated: "update",
    updating: "update",
    fixes: "fix",
    fixed: "fix",
    fixing: "fix",
    confirms: "confirm",
    confirmed: "confirm",
    confirming: "confirm",
    shares: "share",
    shared: "share",
    sharing: "share",
    uploads: "upload",
    uploaded: "upload",
    uploading: "upload",
    attaches: "attach",
    attached: "attach",
    attaching: "attach",
  };

  for (const [inflected, base] of Object.entries(INFLECTIONS)) {
    it(`${inflected} -> ${base}`, () => {
      expect(normalizeActionToken(inflected)).toBe(base);
    });
  }

  it("already-base action-verb forms pass through unchanged", () => {
    for (const base of ["review", "send", "submit", "update", "fix", "confirm", "share", "upload", "attach"]) {
      expect(normalizeActionToken(base)).toBe(base);
    }
  });
});

describe("normalizeActionToken: noun safety (Prompt 6R-B Task 4D)", () => {
  it("does not mangle ordinary content nouns that happen to end in -s/-ed/-ing-shaped substrings", () => {
    for (const noun of ["business", "analysis", "status", "address"]) {
      expect(normalizeActionToken(noun)).toBe(noun);
    }
  });

  it("does not touch action verbs outside the small canonical inventory", () => {
    // "confirming" -> "confirm" is in-inventory, but an unrelated "-ing" word must stay untouched.
    expect(normalizeActionToken("something")).toBe("something");
    expect(normalizeActionToken("meeting")).toBe("meeting");
  });
});

describe("buildMaskedMessage: requestSignature inflection regressions (Prompt 6R-B)", () => {
  it("Task 4A: 'Review the deck.' / 'Could you review the deck?' / 'Could you review the deck again?' all converge on the same core", () => {
    const a = mask("Review the deck.").masked.requestSignature;
    const b = mask("Could you review the deck?").masked.requestSignature;
    const c = mask("Could you review the deck again?").masked.requestSignature;
    for (const sig of [a, b, c]) {
      expect([...sig].sort()).toEqual(["deck", "review"]);
    }
  });

  it("Task 4B: an irregular inflected action token ('sent') produced by a real head act normalizes to its base form", () => {
    const baseline = mask("Could you send the report?").masked.requestSignature;
    expect([...baseline].sort()).toEqual(["report", "send"]);

    // "get X sent" is a natural causative construction whose head act clause contains the
    // irregular past participle "sent" rather than the bare verb "send".
    const { masked, headAct } = mask("Could you get this sent today?");
    expect(headAct.strategyName).toBe("query_preparatory"); // detected via "could you", not "get"
    expect(masked.requestSignature).toContain("send");
    expect(masked.requestSignature).not.toContain("sent");
  });
});

describe("buildContextMaskedMessage: context-only masking for non-request messages (Prompt 7B)", () => {
  it("copies messageId/timestamp/senderId/recipientIds normally", () => {
    const message = buildMessage("done");
    const masked = buildContextMaskedMessage(message);
    expect(masked.messageId).toBe(message.id);
    expect(masked.timestamp).toBe(message.timestamp);
    expect(masked.senderId).toBe(message.senderId);
    expect(masked.recipientIds).toEqual(message.recipientIds);
  });

  it("preserves exact string length (offset-preserving, like buildMaskedMessage)", () => {
    const text = "sent it over an hour ago";
    const masked = buildContextMaskedMessage(buildMessage(text));
    expect(masked.maskedText.length).toBe(text.length);
  });

  it("does not fabricate a request: empty requestClauseSpan and empty requestSignature", () => {
    const masked = buildContextMaskedMessage(buildMessage("done"));
    expect(masked.requestClauseSpan).toEqual({ start: 0, end: 0 });
    expect(masked.requestSignature).toEqual([]);
  });

  it("leaves an ordinary completion signal fully visible in maskedText", () => {
    const masked = buildContextMaskedMessage(buildMessage("done"));
    expect(masked.maskedText).toBe("done");
  });

  it("masks a reproducibly-closed quoted completion signal, exactly as buildMaskedMessage masks quotes", () => {
    const text = 'He said "done" but I have not seen it.';
    const masked = buildContextMaskedMessage(buildMessage(text));
    const quoteStart = text.indexOf('"done"');
    const quoteEnd = quoteStart + '"done"'.length;
    expect(masked.maskedText.slice(quoteStart, quoteEnd)).toBe(" ".repeat(quoteEnd - quoteStart));
    expect(masked.maskedText.length).toBe(text.length);
    expect(masked.maskedSpans).toContainEqual({ start: quoteStart, end: quoteEnd });
  });
});
