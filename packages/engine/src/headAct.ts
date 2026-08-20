/**
 * Identifies whether a message contains a reproducible request and locates
 * its head act — the minimal clause that realizes the request (see
 * CLAUDE.md glossary: "Head act"). Per SPEC.md §6, the detector should
 * match clauses against the CCSARP strategy inventory in LEXICON.md,
 * taking the most-direct matching strategy with ties going to the earliest
 * span.
 *
 * PROVISIONAL: lexicons/directness.ts has zero patterns implemented yet
 * (CLAUDE.md test-first rule 8 — no implementations without fixtures
 * first), so this file cannot yet do genuine LEXICON.md §1 CCSARP
 * matching. It instead uses a small, honestly-scoped pattern ladder
 * covering four common request forms (imperative, "Could/Can/Would/Will
 * you", "I need/want you to", "Let's") to select the head-act clause and
 * extract its verb/object. `ccsarpLevel`/`strategyName` on the returned
 * HeadAct are best-effort approximations of the corresponding CCSARP tier,
 * not the output of matching against LEXICON.md's actual pattern set. This
 * must be superseded once lexicons/directness.ts exists — do not treat
 * ccsarpLevel here as satisfying SPEC.md §7.1's ordinal monotonicity
 * requirement, which depends on the full 9-level LEXICON.md §1 inventory.
 *
 * Also does not yet implement the SPEC.md §6.1 suppression guards or §6.2
 * hint gates (information-seeking questions, quoted/reported text,
 * verbless fragments, unresolved addressees) — those require the shared
 * preprocessing this provisional version doesn't have. A message this
 * heuristic misclassifies as directive-free simply returns `null`, which
 * is the safe direction to err in (CLAUDE.md rule 4: suppress rather than
 * guess).
 *
 * Signature note: the request as literally specified,
 * `identifyHeadAct(sentences: Span[]): HeadAct | null`, is unusable —
 * spans without the string they index into carry no content to classify.
 * This takes `text` as well, matching how every other span-producing
 * function in this codebase is actually called (e.g.
 * `identifyHeadAct(text, segmentSentences(text))`).
 */
import type { HeadAct, Span } from "./types.js";

const IMPERATIVE_STOPLIST = new Set([
  "i",
  "we",
  "you",
  "he",
  "she",
  "they",
  "it",
  "this",
  "that",
  "there",
  "the",
  "a",
  "an",
  "my",
  "our",
  "your",
  "his",
  "her",
  "their",
  "its",
  "could",
  "would",
  "can",
  "will",
  "should",
  "do",
  "does",
  "did",
  "are",
  "is",
  "was",
  "were",
  "have",
  "has",
  "had",
  "may",
  "might",
  "must",
  "what",
  "when",
  "where",
  "why",
  "how",
  "who",
  "which",
  "let",
  "but",
  "and",
  "so",
  "also",
  "however",
  "thanks",
  "thank",
  "sorry",
]);

const ABILITY_QUESTION_RE = /\b(?:Could|Can|Would|Will)\s+you\s+(.+?)\??\s*$/i;
const WANT_STATEMENT_PERFORMATIVE_RE = /\bI(?:'m| am)?\s+(?:asking|requesting)\s+you\s+to\s+(.+?)[.!?]*\s*$/i;
const WANT_STATEMENT_NEED_RE = /\bI\s+(?:need|want|would like|'d like)\s+you\s+to\s+(.+?)[.!?]*\s*$/i;
const SUGGESTORY_LETS_RE = /\bLet'?s\s+(.+?)[.!?]*\s*$/i;
const SUGGESTORY_MAYBE_RE = /\bMaybe\s+we\s+should\s+(.+?)[.!?]*\s*$/i;

interface Classification {
  ccsarpLevel: number;
  strategyName: string;
  verb: string;
  object: string;
}

/** Adverbs commonly inserted between a modal/performative and the actual verb ("could you also send", "could you please send") — skipped so `verb` names the action, not the adverb. */
const LEADING_ADVERBS = new Set(["also", "please", "just", "quickly", "kindly", "maybe", "possibly"]);

function splitVerbObject(fragment: string): { verb: string; object: string } | null {
  let cleaned = fragment.trim().replace(/[.!?]+$/, "").trim();
  if (cleaned.length === 0) return null;

  let spaceIndex = cleaned.search(/\s/);
  while (spaceIndex !== -1 && LEADING_ADVERBS.has(cleaned.slice(0, spaceIndex).toLowerCase())) {
    cleaned = cleaned.slice(spaceIndex + 1).trim();
    spaceIndex = cleaned.search(/\s/);
  }
  if (cleaned.length === 0) return null;

  if (spaceIndex === -1) return { verb: cleaned.toLowerCase(), object: "" };
  return { verb: cleaned.slice(0, spaceIndex).toLowerCase(), object: cleaned.slice(spaceIndex + 1).trim() };
}

function classifyClause(clauseText: string): Classification | null {
  const trimmed = clauseText.trim();
  if (trimmed.length === 0) return null;

  if (/\?\s*$/.test(trimmed)) {
    const m = ABILITY_QUESTION_RE.exec(trimmed);
    if (m?.[1]) {
      const parts = splitVerbObject(m[1]);
      if (parts) return { ccsarpLevel: 5, strategyName: "ability_question", ...parts };
    }
    // A question that isn't one of the recognized request forms is treated
    // as information-seeking, not a directive (SPEC.md §6.1).
    return null;
  }

  let m = WANT_STATEMENT_PERFORMATIVE_RE.exec(trimmed);
  if (m?.[1]) {
    const parts = splitVerbObject(m[1]);
    if (parts) return { ccsarpLevel: 4, strategyName: "want_statement", ...parts };
  }

  m = WANT_STATEMENT_NEED_RE.exec(trimmed);
  if (m?.[1]) {
    const parts = splitVerbObject(m[1]);
    if (parts) return { ccsarpLevel: 4, strategyName: "want_statement", ...parts };
  }

  m = SUGGESTORY_LETS_RE.exec(trimmed);
  if (m?.[1]) {
    const parts = splitVerbObject(m[1]);
    if (parts) return { ccsarpLevel: 6, strategyName: "suggestory", ...parts };
  }

  m = SUGGESTORY_MAYBE_RE.exec(trimmed);
  if (m?.[1]) {
    const parts = splitVerbObject(m[1]);
    if (parts) return { ccsarpLevel: 6, strategyName: "suggestory", ...parts };
  }

  const body = trimmed.replace(/^please\s+/i, "");
  const firstWordMatch = /^([A-Za-z']+)/.exec(body);
  if (firstWordMatch?.[1] && !IMPERATIVE_STOPLIST.has(firstWordMatch[1].toLowerCase())) {
    const parts = splitVerbObject(body);
    if (parts) return { ccsarpLevel: 1, strategyName: "imperative", ...parts };
  }

  return null;
}

export function identifyHeadAct(text: string, sentences: Span[]): HeadAct | null {
  let best: (Classification & { span: Span }) | null = null;

  for (const span of sentences) {
    const clauseText = text.slice(span.start, span.end);
    const classification = classifyClause(clauseText);
    if (!classification) continue;
    if (best === null || classification.ccsarpLevel < best.ccsarpLevel) {
      best = { ...classification, span };
    }
  }

  if (best === null) return null;
  return {
    span: best.span,
    ccsarpLevel: best.ccsarpLevel,
    strategyName: best.strategyName,
    verb: best.verb,
    object: best.object,
  };
}
