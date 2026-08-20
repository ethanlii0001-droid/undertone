/**
 * Tests for segmentSentences (src/segment.ts) against messy real-world
 * workplace text: abbreviations, ellipses, emoji, multi-paragraph pastes.
 */
import { describe, it, expect } from "vitest";
import { segmentSentences } from "../src/segment.js";

function textsOf(source: string) {
  return segmentSentences(source).map((span) => source.slice(span.start, span.end));
}

describe("segmentSentences", () => {
  it("splits a simple two-sentence message", () => {
    const text = "Could you review the deck? Thursday's call depends on it.";
    expect(textsOf(text)).toEqual(["Could you review the deck?", "Thursday's call depends on it."]);
  });

  it("does not split on Mr./Mrs./Dr./Prof. abbreviations", () => {
    const text = "Could you loop in Mr. Alvarez? Dr. Chen already reviewed it.";
    expect(textsOf(text)).toEqual(["Could you loop in Mr. Alvarez?", "Dr. Chen already reviewed it."]);
  });

  it("does not split on e.g. / i.e. abbreviations", () => {
    const text = "Please use the shared template, e.g. the Q3 one. It's in the drive.";
    expect(textsOf(text)).toEqual([
      "Please use the shared template, e.g. the Q3 one.",
      "It's in the drive.",
    ]);
  });

  it("does not split on a.m./p.m. abbreviations", () => {
    const text = "Send it by 9 a.m. Otherwise it misses the run.";
    expect(textsOf(text)).toEqual(["Send it by 9 a.m.", "Otherwise it misses the run."]);
  });

  it("handles EOD/COB without spurious splits", () => {
    const text = "Submit the report by EOD. Otherwise Finance can't process it.";
    expect(textsOf(text)).toEqual([
      "Submit the report by EOD.",
      "Otherwise Finance can't process it.",
    ]);
  });

  it("treats an ellipsis as one boundary, not three", () => {
    const text = "I was thinking... Maybe we should push the deadline.";
    expect(textsOf(text)).toEqual(["I was thinking...", "Maybe we should push the deadline."]);
  });

  it("does not split a trailing-off ellipsis followed by lowercase continuation", () => {
    const text = "If you get a chance... no pressure though.";
    expect(textsOf(text)).toEqual(["If you get a chance... no pressure though."]);
  });

  it("handles the single-character ellipsis glyph", () => {
    const text = "Still waiting on this… Can you send an update?";
    expect(textsOf(text)).toEqual(["Still waiting on this…", "Can you send an update?"]);
  });

  it("does not split on a decimal number", () => {
    const text = "The budget is 4.5 million this quarter.";
    expect(textsOf(text)).toEqual(["The budget is 4.5 million this quarter."]);
  });

  it("keeps trailing emoji attached and still finds the next sentence boundary", () => {
    const text = "Great work on this!🎉 Could you also send the summary?";
    expect(textsOf(text)).toEqual(["Great work on this!🎉", "Could you also send the summary?"]);
  });

  it("does not split inside an emoji-only reaction line embedded in text", () => {
    const text = "Thanks so much 🙏 really appreciate it.";
    expect(textsOf(text)).toEqual(["Thanks so much 🙏 really appreciate it."]);
  });

  it("splits on a blank-line paragraph break even without terminal punctuation", () => {
    const text = "Need this today\n\nNo more details for now";
    expect(textsOf(text)).toEqual(["Need this today", "No more details for now"]);
  });

  it("handles closing quotes before the sentence boundary", () => {
    const text = 'She said "stop." Then she left the room.';
    expect(textsOf(text)).toEqual(['She said "stop."', "Then she left the room."]);
  });

  it("returns an empty array for empty or whitespace-only input", () => {
    expect(segmentSentences("")).toEqual([]);
    expect(segmentSentences("   \n\n  ")).toEqual([]);
  });

  it("returns one sentence for input with no terminal punctuation", () => {
    const text = "please send the file over";
    expect(textsOf(text)).toEqual(["please send the file over"]);
  });

  it("produces spans that index exactly into the original string", () => {
    const text = "Could you review the deck? Thanks for the help.";
    const spans = segmentSentences(text);
    expect(spans.map((span) => text.slice(span.start, span.end))).toEqual([
      "Could you review the deck?",
      "Thanks for the help.",
    ]);
    for (const span of spans) {
      expect(span.start).toBeGreaterThanOrEqual(0);
      expect(span.end).toBeLessThanOrEqual(text.length);
      expect(span.start).toBeLessThan(span.end);
    }
    expect(spans[0]?.start).toBe(0);
    expect(spans[0]?.end).toBe(text.indexOf("? ") + 1);
  });
});
