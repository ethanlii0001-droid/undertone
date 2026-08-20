/**
 * Parses a raw pasted thread — Slack, Teams, or a quoted email chain — into
 * one RawMessage per detected message, or falls back to a single
 * unknown-sender message when no structure is detected. NOT part of
 * SPEC.md's pipeline (see types.ts's RawMessage doc comment): SPEC.md's §5
 * pipeline assumes a Message/Thread already exists; this is new,
 * unspecified functionality that produces the raw material for it.
 *
 * Deterministic, pattern-based (no NLP/date library — CLAUDE.md rule 2).
 * Detects three header shapes, tried in this order at each candidate line:
 *
 *   1. Email quote:  "On <date...>, <name> wrote:"
 *   2. Teams:        a lone name line immediately followed by a
 *                     time-only line (both must be preceded by a blank
 *                     line or the start of input)
 *   3. Slack:        "Name<2+ spaces>Time" on one line, time optional
 *                     (supports a missing timestamp), also must be
 *                     preceded by a blank line or the start of input
 *
 * The "preceded by blank line or start of input" requirement on (2)/(3) is
 * what keeps this from false-positioning on an ordinary Title Case
 * sentence in the middle of a paragraph — real Slack/Teams pastes are
 * blank-line-separated between messages.
 *
 * Every RawMessage.span is an exact substring of `raw`
 * (`text === raw.slice(span.start, span.end)`), so callers composing
 * further spans from `text` (e.g. via segmentSentences) only need to add
 * `span.start` to land back on `raw`'s own offsets.
 */
import type { RawMessage, Span } from "./types.js";

interface Line {
  text: string;
  start: number;
  /** End of the line's content, excluding the line terminator. */
  end: number;
  /** Start of the next line (after the terminator), or `raw.length` for the last line. */
  nextStart: number;
}

function splitLines(raw: string): Line[] {
  const lines: Line[] = [];
  let pos = 0;
  while (pos <= raw.length) {
    let newlineIndex = raw.indexOf("\n", pos);
    if (newlineIndex === -1) {
      lines.push({ text: raw.slice(pos), start: pos, end: raw.length, nextStart: raw.length });
      break;
    }
    let end = newlineIndex;
    if (end > pos && raw[end - 1] === "\r") end -= 1;
    lines.push({ text: raw.slice(pos, end), start: pos, end, nextStart: newlineIndex + 1 });
    pos = newlineIndex + 1;
  }
  return lines;
}

function isBlank(line: Line | undefined): boolean {
  return line === undefined || line.text.trim().length === 0;
}

const EMAIL_WROTE_RE = /^On\s+(.+?)\s+wrote:\s*$/;
const EMAIL_ADDRESS_TAIL_RE = /([A-Za-z][\w.'-]*(?:\s+[A-Za-z][\w.'-]*)*)\s*<[^<>]+>\s*$/;

const NAME_ONLY_RE = /^[A-Z][A-Za-z'.-]*(?:\s+[A-Z][A-Za-z'.-]*){0,3}$/;
const TIME_ONLY_RE = /^\d{1,2}:\d{2}(?:\s*[AaPp][Mm])?$/;
const SLACK_HEADER_RE =
  /^([A-Z][A-Za-z'.-]*(?:\s+[A-Z][A-Za-z'.-]*){0,3})(?:[ \t]{2,}(\d{1,2}:\d{2}(?:\s*[AaPp][Mm])?)(?:\s*\(edited\))?)?[ \t]*$/;

/** A line made up entirely of emoji, digits, whitespace, and reaction-count punctuation — e.g. "👍 2  🎉 1". */
const REACTION_LINE_RE = /^[\p{Extended_Pictographic}️‍\s\d+]+$/u;

function parseEmailHeader(line: Line): { sender: string; timestamp: string | null } | null {
  const match = EMAIL_WROTE_RE.exec(line.text.trim());
  if (!match) return null;
  const blob = match[1] ?? "";
  const addressMatch = EMAIL_ADDRESS_TAIL_RE.exec(blob);
  if (addressMatch) {
    const sender = (addressMatch[1] ?? "").trim();
    const timestamp = blob.slice(0, addressMatch.index).replace(/,\s*$/, "").trim();
    return { sender: sender.length > 0 ? sender : "unknown", timestamp: timestamp.length > 0 ? timestamp : null };
  }
  const parts = blob.split(",");
  if (parts.length >= 2) {
    const sender = (parts[parts.length - 1] ?? "").trim();
    const timestamp = parts.slice(0, -1).join(",").trim();
    return { sender: sender.length > 0 ? sender : "unknown", timestamp: timestamp.length > 0 ? timestamp : null };
  }
  const sender = blob.trim();
  return { sender: sender.length > 0 ? sender : "unknown", timestamp: null };
}

interface HeaderMatch {
  sender: string;
  timestamp: string | null;
  /** Index (into `lines`) of the first line after the header. */
  bodyStartLine: number;
}

function matchHeaderAt(lines: Line[], index: number): HeaderMatch | null {
  const line = lines[index];
  if (!line) return null;

  const email = parseEmailHeader(line);
  if (email) {
    return { sender: email.sender, timestamp: email.timestamp, bodyStartLine: index + 1 };
  }

  const precededByBoundary = index === 0 || isBlank(lines[index - 1]);
  if (!precededByBoundary) return null;

  const trimmed = line.text.trim();

  const next = lines[index + 1];
  if (NAME_ONLY_RE.test(trimmed) && next !== undefined && TIME_ONLY_RE.test(next.text.trim())) {
    return { sender: trimmed, timestamp: next.text.trim(), bodyStartLine: index + 2 };
  }

  const slackMatch = SLACK_HEADER_RE.exec(line.text.replace(/[ \t]+$/, ""));
  if (slackMatch) {
    const sender = (slackMatch[1] ?? "").trim();
    const timestamp = slackMatch[2] ?? null;
    if (sender.length > 0) {
      return { sender, timestamp, bodyStartLine: index + 1 };
    }
  }

  return null;
}

/** Advances past leading blank lines in a body's line range, returning the new (inclusive) start line index. */
function trimBodyStart(lines: Line[], startLine: number, endLineExclusive: number): number {
  let start = startLine;
  while (start < endLineExclusive && isBlank(lines[start])) start += 1;
  return start;
}

/** Trims trailing blank lines and a trailing emoji-reaction-only line from a body's line range, returning the new exclusive end line index. */
function trimBodyEnd(lines: Line[], startLine: number, endLineExclusive: number): number {
  let end = endLineExclusive;
  while (end > startLine) {
    const line = lines[end - 1];
    if (line === undefined) break;
    const trimmed = line.text.trim();
    if (trimmed.length === 0 || REACTION_LINE_RE.test(trimmed)) {
      end -= 1;
      continue;
    }
    break;
  }
  return end;
}

function bodySpan(lines: Line[], raw: string, startLine: number, endLineExclusive: number): Span {
  if (startLine >= endLineExclusive) {
    const at = lines[startLine]?.start ?? raw.length;
    return { start: at, end: at };
  }
  const trimmedStart = trimBodyStart(lines, startLine, endLineExclusive);
  const trimmedEnd = trimBodyEnd(lines, trimmedStart, endLineExclusive);
  if (trimmedEnd <= trimmedStart) {
    const at = lines[startLine]?.start ?? raw.length;
    return { start: at, end: at };
  }
  const firstLine = lines[trimmedStart];
  const lastLine = lines[trimmedEnd - 1];
  if (!firstLine || !lastLine) return { start: 0, end: 0 };
  return trimSpan(raw, firstLine.start, lastLine.end);
}

/** Trims leading/trailing whitespace from a span while keeping it an exact substring of `raw`. */
function trimSpan(raw: string, start: number, end: number): Span {
  let s = start;
  let e = end;
  while (s < e && /\s/.test(raw[s] ?? "")) s++;
  while (e > s && /\s/.test(raw[e - 1] ?? "")) e--;
  return { start: s, end: e };
}

export function parseThread(raw: string): RawMessage[] {
  if (raw.trim().length === 0) return [];

  const lines = splitLines(raw);
  const headers: Array<{ lineIndex: number; sender: string; timestamp: string | null; bodyStartLine: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const match = matchHeaderAt(lines, i);
    if (match) {
      headers.push({ lineIndex: i, sender: match.sender, timestamp: match.timestamp, bodyStartLine: match.bodyStartLine });
    }
  }

  if (headers.length === 0) {
    return [{ sender: "unknown", timestamp: null, text: raw, span: { start: 0, end: raw.length } }];
  }

  const messages: RawMessage[] = [];

  const firstHeaderLine = headers[0]?.lineIndex ?? 0;
  if (firstHeaderLine > 0) {
    const span = bodySpan(lines, raw, 0, firstHeaderLine);
    if (span.end > span.start) {
      messages.push({ sender: "unknown", timestamp: null, text: raw.slice(span.start, span.end), span });
    }
  }

  for (let h = 0; h < headers.length; h++) {
    const header = headers[h];
    if (!header) continue;
    const nextHeaderLine = headers[h + 1]?.lineIndex ?? lines.length;
    const span = bodySpan(lines, raw, header.bodyStartLine, nextHeaderLine);
    messages.push({
      sender: header.sender,
      timestamp: header.timestamp,
      text: raw.slice(span.start, span.end),
      span,
    });
  }

  return messages;
}
