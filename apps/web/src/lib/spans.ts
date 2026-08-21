/**
 * Splits a message's original text into contiguous segments annotated with
 * whichever Evidence entries cover each segment, so the evidence trace (
 * Prompt 9A §5) can render exact engine offsets without recomputing
 * anything. Boundary points are derived only from the Evidence spans
 * themselves, so overlapping evidence (e.g. two same-scorer matches sharing
 * characters) is handled without double-rendering text.
 */
import type { Evidence } from "@undertone/engine/src/types";

export interface TextSegment {
  text: string;
  start: number;
  end: number;
  evidence: Evidence[];
}

export function segmentText(text: string, evidence: Evidence[]): TextSegment[] {
  if (evidence.length === 0) {
    return [{ text, start: 0, end: text.length, evidence: [] }];
  }

  const boundaries = new Set<number>([0, text.length]);
  for (const ev of evidence) {
    boundaries.add(clamp(ev.span.start, 0, text.length));
    boundaries.add(clamp(ev.span.end, 0, text.length));
  }
  const sorted = Array.from(boundaries).sort((a, b) => a - b);

  const segments: TextSegment[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i]!;
    const end = sorted[i + 1]!;
    if (start === end) continue;
    const covering = evidence.filter((ev) => ev.span.start <= start && ev.span.end >= end);
    segments.push({ text: text.slice(start, end), start, end, evidence: covering });
  }
  return segments;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
