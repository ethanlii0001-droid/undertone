/**
 * Segments normalized message text into sentences and clauses, per SPEC.md
 * §5 step 2 (Pipeline). Provides the clause boundaries that headAct.ts
 * matches CCSARP strategies against, and the sentence boundaries that force
 * patterns must never cross (LEXICON.md §0.4 rule 2: "No pattern may match
 * across a sentence boundary").
 *
 * Deterministic, pattern-based segmentation (no NLP library — CLAUDE.md
 * rule 2): scans for `. ! ? …`/`...`, treating a match as a real sentence
 * boundary only when it isn't a known abbreviation, isn't glued to a
 * lowercase continuation (decimals, URLs), and is followed — after any
 * closing quotes/brackets/emoji — by whitespace and then an uppercase
 * letter, digit, quote, emoji, or end of string. A blank line (paragraph
 * break) is always a boundary, even with no terminal punctuation, since
 * real pasted messages routinely omit it.
 *
 * Returned spans are relative to the `text` argument only. If `text` is
 * itself a substring another function extracted (e.g. a RawMessage.text
 * from parseThread.ts), the caller must add that substring's own span.start
 * to translate a returned span back to the original raw string's offsets —
 * this function has no way to know it was given a substring.
 */
import type { Span } from "./types.js";

/**
 * Words/tokens whose trailing period must not be read as a sentence
 * boundary. Workplace-register personal titles, Latin abbreviations, and
 * month abbreviations — not an exhaustive list, extend as real inputs
 * demand it.
 *
 * Deliberately excludes "a.m."/"p.m.": unlike "Mr."/"Dr." (always followed
 * by a name, never sentence-final), a time-of-day abbreviation can be
 * either sentence-final ("Send it by 9 a.m. Otherwise...") or mid-sentence
 * ("at 9 a.m. tomorrow"). Leaving it off this list lets the general
 * whitespace+capital-letter rule decide instead, which gets both of those
 * cases right; it can still misfire on "a.m. Pacific time works" (a
 * capitalized continuation of the same sentence) — a known residual
 * ambiguity, not fixable by a static list either way.
 */
const ABBREVIATIONS = new Set([
  "mr.",
  "mrs.",
  "ms.",
  "dr.",
  "prof.",
  "sr.",
  "jr.",
  "st.",
  "vs.",
  "etc.",
  "e.g.",
  "i.e.",
  "approx.",
  "inc.",
  "ltd.",
  "co.",
  "corp.",
  "no.",
  "dept.",
  "jan.",
  "feb.",
  "mar.",
  "apr.",
  "jun.",
  "jul.",
  "aug.",
  "sep.",
  "sept.",
  "oct.",
  "nov.",
  "dec.",
]);

/** Closing quotes/brackets that may sit between terminal punctuation and the whitespace that follows it. */
function isCloser(ch: string | undefined): boolean {
  return ch !== undefined && /['")\]}”’]/.test(ch);
}

/**
 * Emoji, emoji variation selectors, and zero-width joiners — treated as
 * boundary-transparent, like closers. Takes a Unicode code point, not a
 * UTF-16 code unit: most emoji (e.g. 🎉) are astral characters represented
 * as a surrogate pair, so testing `text[i]` (one code unit — half the
 * emoji) against this pattern would never match. Callers must use
 * `text.codePointAt(i)` and advance by `codePointWidth(cp)`, not by 1.
 */
function isEmojiOrJoinerCodePoint(cp: number): boolean {
  const ch = String.fromCodePoint(cp);
  return /\p{Extended_Pictographic}|️|‍/u.test(ch);
}

/** 2 for an astral code point (encoded as a UTF-16 surrogate pair), else 1. */
function codePointWidth(cp: number): number {
  return cp > 0xffff ? 2 : 1;
}

function isWhitespace(ch: string | undefined): boolean {
  return ch !== undefined && /\s/.test(ch);
}

/** Scans backward from `end` over a run of letters and internal periods, to capture multi-period abbreviations like "e.g.". */
function findAbbreviationTokenStart(text: string, end: number): number {
  let s = end;
  while (s > 0 && /[A-Za-z.]/.test(text[s - 1] ?? "")) s--;
  return s;
}

/** True if `text[pos:]` looks like the start of a new sentence: uppercase letter, digit, quote, or emoji. */
function looksLikeSentenceStart(text: string, pos: number): boolean {
  if (pos >= text.length) return true;
  const cp = text.codePointAt(pos);
  if (cp === undefined) return true;
  const ch = String.fromCodePoint(cp);
  return /[A-Z0-9'"“‘]/.test(ch) || isEmojiOrJoinerCodePoint(cp);
}

function trimSpan(text: string, start: number, end: number): Span {
  let s = start;
  let e = end;
  while (s < e && isWhitespace(text[s])) s++;
  while (e > s && isWhitespace(text[e - 1])) e--;
  return { start: s, end: e };
}

export function segmentSentences(text: string): Span[] {
  const spans: Span[] = [];
  let sentenceStart = 0;
  const n = text.length;
  let i = 0;

  while (i < n) {
    const ch = text[i];

    // Paragraph break: a newline followed (possibly after spaces/tabs) by
    // another newline is always a boundary, independent of punctuation.
    if (ch === "\n") {
      let k = i + 1;
      while (k < n && (text[k] === " " || text[k] === "\t")) k++;
      if (text[k] === "\n") {
        const span = trimSpan(text, sentenceStart, i);
        if (span.end > span.start) spans.push(span);
        while (k < n && isWhitespace(text[k])) k++;
        sentenceStart = k;
        i = k;
        continue;
      }
      i++;
      continue;
    }

    if (ch === "." || ch === "!" || ch === "?" || ch === "…" /* … */) {
      let end = i + 1;
      if (ch === ".") {
        while (text[end] === ".") end++;
      }

      let isAbbrev = false;
      if (ch === "." && end - i === 1) {
        const tokenStart = findAbbreviationTokenStart(text, end);
        const token = text.slice(tokenStart, end).toLowerCase();
        isAbbrev = ABBREVIATIONS.has(token);
      }

      let after = end;
      while (after < n) {
        if (isCloser(text[after])) {
          after += 1;
          continue;
        }
        const cp = text.codePointAt(after);
        if (cp !== undefined && isEmojiOrJoinerCodePoint(cp)) {
          after += codePointWidth(cp);
          continue;
        }
        break;
      }

      let boundaryOk = false;
      if (!isAbbrev) {
        if (after >= n) {
          boundaryOk = true;
        } else if (isWhitespace(text[after])) {
          let k = after;
          while (k < n && isWhitespace(text[k])) k++;
          boundaryOk = looksLikeSentenceStart(text, k);
        }
      }

      if (boundaryOk) {
        const span = trimSpan(text, sentenceStart, after);
        if (span.end > span.start) spans.push(span);
        let next = after;
        while (next < n && isWhitespace(text[next])) next++;
        sentenceStart = next;
        i = next;
        continue;
      }

      i = end;
      continue;
    }

    i++;
  }

  const finalSpan = trimSpan(text, sentenceStart, n);
  if (finalSpan.end > finalSpan.start) spans.push(finalSpan);

  return spans;
}
