/**
 * Tests for parseThread (src/parseThread.ts) against messy real-world paste
 * formats: Slack, Teams, quoted email chains, missing timestamps,
 * inconsistent whitespace, inline emoji reactions, and <@U012ABC> mentions.
 */
import { describe, it, expect } from "vitest";
import { parseThread } from "../src/parseThread.js";

describe("parseThread", () => {
  it("falls back to a single unknown-sender message for unstructured input", () => {
    const raw = "please send the file over, no header here at all";
    const messages = parseThread(raw);
    expect(messages).toEqual([
      { sender: "unknown", timestamp: null, text: raw, span: { start: 0, end: raw.length } },
    ]);
  });

  it("returns no messages for empty or whitespace-only input", () => {
    expect(parseThread("")).toEqual([]);
    expect(parseThread("   \n\n  ")).toEqual([]);
  });

  it("parses a Slack-style paste (Name<spaces>Time header)", () => {
    const raw = ["Ethan Li  10:32 AM", "Could you review the deck before Thursday?"].join("\n");
    const messages = parseThread(raw);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.sender).toBe("Ethan Li");
    expect(messages[0]?.timestamp).toBe("10:32 AM");
    expect(messages[0]?.text).toBe("Could you review the deck before Thursday?");
  });

  it("parses multiple Slack-style messages separated by blank lines", () => {
    const raw = [
      "Ethan Li  10:32 AM",
      "Could you review the deck before Thursday?",
      "",
      "Priya Shah  10:41 AM",
      "Yep, on it.",
    ].join("\n");
    const messages = parseThread(raw);
    expect(messages).toHaveLength(2);
    expect(messages[0]?.sender).toBe("Ethan Li");
    expect(messages[0]?.text).toBe("Could you review the deck before Thursday?");
    expect(messages[1]?.sender).toBe("Priya Shah");
    expect(messages[1]?.timestamp).toBe("10:41 AM");
    expect(messages[1]?.text).toBe("Yep, on it.");
  });

  it("handles a Slack header with no timestamp (missing timestamp)", () => {
    const raw = ["Ethan Li", "", "Could you send the update?"].join("\n");
    const messages = parseThread(raw);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.sender).toBe("Ethan Li");
    expect(messages[0]?.timestamp).toBeNull();
    expect(messages[0]?.text).toBe("Could you send the update?");
  });

  it("parses a Teams-style paste (Name on its own line, Time on the next)", () => {
    const raw = ["Ethan Li", "10:32 AM", "Could you review the deck before Thursday?"].join("\n");
    const messages = parseThread(raw);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.sender).toBe("Ethan Li");
    expect(messages[0]?.timestamp).toBe("10:32 AM");
    expect(messages[0]?.text).toBe("Could you review the deck before Thursday?");
  });

  it("parses a quoted email chain (On ... wrote:)", () => {
    const raw = [
      "Sounds good, I'll take care of it today.",
      "",
      "On Tue, Jan 4, 2022 at 3:45 PM, John Doe <john@example.com> wrote:",
      "> Could you send the signed contract by Friday?",
    ].join("\n");
    const messages = parseThread(raw);
    expect(messages).toHaveLength(2);
    expect(messages[0]?.sender).toBe("unknown");
    expect(messages[0]?.text).toBe("Sounds good, I'll take care of it today.");
    expect(messages[1]?.sender).toBe("John Doe");
    expect(messages[1]?.timestamp).toBe("Tue, Jan 4, 2022 at 3:45 PM");
    expect(messages[1]?.text).toBe("> Could you send the signed contract by Friday?");
  });

  it("parses an email header with no bracketed email address (bare name)", () => {
    const raw = ["On Tue, Jan 4, X wrote:", "Could you take a look?"].join("\n");
    const messages = parseThread(raw);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.sender).toBe("X");
    expect(messages[0]?.timestamp).toBe("Tue, Jan 4");
    expect(messages[0]?.text).toBe("Could you take a look?");
  });

  it("preserves inline <@U012ABC> Slack mention syntax verbatim in the text", () => {
    const raw = ["Ethan Li  10:32 AM", "Hey <@U012ABC>, could you take a look at this?"].join("\n");
    const messages = parseThread(raw);
    expect(messages[0]?.text).toBe("Hey <@U012ABC>, could you take a look at this?");
  });

  it("excludes a trailing emoji-reaction-only line from the message body", () => {
    const raw = [
      "Ethan Li  10:32 AM",
      "Could you review the deck?",
      "👍 2  🎉 1",
      "",
      "Priya Shah  10:41 AM",
      "On it.",
    ].join("\n");
    const messages = parseThread(raw);
    expect(messages).toHaveLength(2);
    expect(messages[0]?.text).toBe("Could you review the deck?");
    expect(messages[0]?.text).not.toContain("👍");
  });

  it("tolerates inconsistent whitespace around Slack headers", () => {
    const raw = ["Ethan   Li\t\t10:32   AM   ", "  Could you review the deck?  "].join("\n");
    const messages = parseThread(raw);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.sender).toBe("Ethan   Li");
    expect(messages[0]?.text).toBe("Could you review the deck?");
  });

  it("every message span is an exact substring of the original raw string", () => {
    const raw = [
      "Ethan Li  10:32 AM",
      "Could you review the deck before Thursday?",
      "",
      "Priya Shah  10:41 AM",
      "Yep, on it.",
    ].join("\n");
    const messages = parseThread(raw);
    for (const message of messages) {
      expect(raw.slice(message.span.start, message.span.end)).toBe(message.text);
    }
  });
});
