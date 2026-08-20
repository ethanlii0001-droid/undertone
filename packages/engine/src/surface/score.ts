/**
 * Surface strength scorer: how forcefully the identified request is
 * phrased, per SPEC.md §7. Combines the CCSARP base strategy score
 * (LEXICON.md §1) with the internal-modification delta from downgraders
 * (LEXICON.md §2) and upgraders (LEXICON.md §3):
 *
 *   modifierDelta = clamp(normalizedDowngraders + normalizedUpgraders, -3, +3)
 *   surface = clamp(baseStrategy + modifierDelta, 0, 10)
 *
 * (SPEC.md §7). There is no exponential/diminishing-returns formula and no
 * hidden per-subcategory cap — the single transparent aggregate clamp
 * above is the only cap (SPEC.md §7).
 *
 * Independence (CLAUDE.md rule 3, SPEC.md §5.1): this module imports only
 * lexicons/directness.ts, lexicons/downgraders.ts, and lexicons/upgraders.ts
 * for lexical data, plus shared preprocessing (types.ts, segment.ts,
 * headAct.ts's matchDirectness) — never force/*.ts or a force lexicon.
 */
import type { Evidence, EvidenceCategory, HeadAct, LexEntry, Message, Span, SurfaceScore } from "../types.js";
import { segmentSentences } from "../segment.js";
import { matchDirectness } from "../headAct.js";
import { DIRECTNESS_LEVEL_BY_SUBCATEGORY, SURFACE_STRATEGY_SCALE } from "../lexicons/directness.js";
import { DOWNGRADERS, DOWNGRADER_SCALE } from "../lexicons/downgraders.js";
import {
  UPGRADERS,
  UPGRADER_SCALE,
  EMPHATIC_ORTHOGRAPHY_EXCLUDED_TOKENS,
  EMPHATIC_ORTHOGRAPHY_EXCLUDED_PHRASES,
} from "../lexicons/upgraders.js";

/** SPEC.md §7's transparent aggregate modifier clamp — the only cap in v1.1. */
const MODIFIER_DELTA_CLAMP = 3.0;
/** SPEC.md §7's final surface range. */
const SURFACE_MIN = 0;
const SURFACE_MAX = 10;
/** Float-comparison tolerance for deciding whether the aggregate clamp actually changed anything (Task 7 cap bookkeeping). */
const CLAMP_EPSILON = 1e-9;

interface RawMatch {
  entry: LexEntry;
  /** Absolute span into message.text. */
  span: Span;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * True for the one UPGRADERS entry whose matching-time behavior needs an
 * exclusion list beyond what its regex alone can express: the all-caps
 * `emphatic_orthography` pattern, which must skip workplace acronyms
 * (LEXICON.md §3's own note) and words LEXICON.md §0.3 has already ruled
 * out of the surface upgrader lexicon (`ASAP`, `BLOCKED`, etc. — see
 * `EMPHATIC_ORTHOGRAPHY_EXCLUDED_TOKENS`). Identified structurally
 * (all-caps subcategory plus an A-Z-only pattern) rather than by
 * re-writing the regex.
 */
function isEmphaticAllCapsEntry(entry: LexEntry): boolean {
  return (
    entry.category === "upgrader" &&
    entry.subcategory === "emphatic_orthography" &&
    typeof entry.pattern !== "string" &&
    entry.pattern.source.includes("A-Z")
  );
}

/**
 * True when `[span.start, span.end)` in `clauseText` overlaps an
 * occurrence of one of `EMPHATIC_ORTHOGRAPHY_EXCLUDED_PHRASES` (`right
 * away`, `first thing`) — i.e. the candidate all-caps token is one word of
 * a canonical LEXICON.md §0.3 force-only phrase ("RIGHT AWAY" matching on
 * "RIGHT", "FIRST THING" on "FIRST"), matched case-insensitively so a
 * half-capitalized rendering is still caught. Checked in addition to
 * `EMPHATIC_ORTHOGRAPHY_EXCLUDED_TOKENS` rather than folded into a
 * word-level blacklist, since blacklisting "RIGHT"/"FIRST" as bare tokens
 * would also suppress genuine unrelated emphatic use of those words.
 */
function isPartOfExcludedPhrase(clauseText: string, span: Span): boolean {
  for (const phrase of EMPHATIC_ORTHOGRAPHY_EXCLUDED_PHRASES) {
    const flags = phrase.flags.includes("g") ? phrase.flags : `${phrase.flags}g`;
    const global = new RegExp(phrase.source, flags);
    let match: RegExpExecArray | null;
    while ((match = global.exec(clauseText)) !== null) {
      const phraseStart = match.index;
      const phraseEnd = match.index + match[0].length;
      if (span.start < phraseEnd && span.end > phraseStart) return true;
      if (match[0].length === 0) global.lastIndex += 1;
    }
  }
  return false;
}

/**
 * Finds the first match of `entry.pattern` in `clauseText` that isn't an
 * excluded all-caps token or part of an excluded phrase (LEXICON.md §3
 * acronym note, and the LEXICON.md §0.3 collision words/phrases this
 * Prompt 5 reconciliation closed — see `EMPHATIC_ORTHOGRAPHY_EXCLUDED_TOKENS`
 * / `EMPHATIC_ORTHOGRAPHY_EXCLUDED_PHRASES`), matching LEXICON.md §0.4
 * rule 4 ("a pattern that fires more than once in the same clause counts
 * once"). Scans forward past excluded matches only for the one entry that
 * needs it; every other entry returns on its first match, identical to a
 * plain non-global `.exec()`.
 */
function firstQualifyingMatch(entry: LexEntry, clauseText: string): Span | null {
  if (typeof entry.pattern === "string") return null;
  const skipExcluded = isEmphaticAllCapsEntry(entry);
  if (!skipExcluded) {
    const match = entry.pattern.exec(clauseText);
    if (!match) return null;
    return { start: match.index, end: match.index + match[0].length };
  }
  const flags = entry.pattern.flags.includes("g") ? entry.pattern.flags : `${entry.pattern.flags}g`;
  const global = new RegExp(entry.pattern.source, flags);
  let match: RegExpExecArray | null;
  while ((match = global.exec(clauseText)) !== null) {
    const span: Span = { start: match.index, end: match.index + match[0].length };
    if (EMPHATIC_ORTHOGRAPHY_EXCLUDED_TOKENS.has(match[0].toUpperCase()) || isPartOfExcludedPhrase(clauseText, span)) {
      if (match[0].length === 0) global.lastIndex += 1;
      continue;
    }
    return span;
  }
  return null;
}

/** Scans one clause against a modifier lexicon, returning every entry's first qualifying match (relative to `clauseText`). */
function collectMatches(entries: readonly LexEntry[], clauseText: string): Array<{ entry: LexEntry; span: Span }> {
  const results: Array<{ entry: LexEntry; span: Span }> = [];
  for (const entry of entries) {
    const span = firstQualifyingMatch(entry, clauseText);
    if (span) results.push({ entry, span });
  }
  return results;
}

/**
 * LEXICON.md §0.4 rule 9 (Prompt 5 reconciliation): when two modifier
 * matches nest — one span fully inside another — they are the same
 * underlying lexical construction counted twice (e.g. `up to you` inside
 * `totally up to you`, `any chance` inside `by any chance`, `really`
 * inside `really really`/`really important`), so only the longest, most
 * specific match survives. This is modifier-vs-modifier, unrelated to
 * §0.2 absorption (modifier vs. the directness match, handled separately
 * below). Genuinely non-overlapping modifiers (disjoint spans) are never
 * touched by this.
 */
function dedupeOverlappingModifiers<T extends { entry: LexEntry; span: Span }>(matches: T[]): T[] {
  const byLengthDesc = [...matches].sort((a, b) => b.span.end - b.span.start - (a.span.end - a.span.start));
  const kept: T[] = [];
  for (const candidate of byLengthDesc) {
    const nestedInKept = kept.some((k) => candidate.span.start >= k.span.start && candidate.span.end <= k.span.end);
    if (!nestedInKept) kept.push(candidate);
  }
  // Restore the original scan order (lexicon array order) rather than the length-sorted working order.
  return matches.filter((m) => kept.includes(m));
}

/**
 * LEXICON.md §0.2 absorption exceptions (Prompt 5 reconciliation): a
 * handful of §1 directness entries have their OWN canonical note stating
 * that a specific modifier contained within their match is priced
 * separately rather than absorbed — because that modifier is a bolt-on,
 * not constitutive of the strategy's minimal realization (contrast the L5
 * want-statement `'d`, which §0.2's own rationale treats as constitutive
 * and therefore absorbed). Each row is a named, narrow exception read
 * directly off that entry's note; sibling entries whose notes are silent
 * on the point (e.g. "would you", "can you") are NOT listed, and stay
 * under the default absorption rule. The `syntactic.weak_deontic` "you
 * should" exception is handled separately in `scoreSurface` since it is
 * unconditional (not tied to which modifier subcategory is involved).
 */
const ABSORPTION_EXCEPTIONS: ReadonlyArray<{
  directnessPatternSource: string;
  exemptModifierSubcategories: readonly string[];
}> = [
  // "Could you...?" — LEXICON.md §1 L7: "the conditional is scored
  // separately as a downgrader because it is not constitutive of the
  // strategy (cf. can you)."
  { directnessPatternSource: /\bcould you\b/i.source, exemptModifierSubcategories: ["syntactic.conditional"] },
  // "Maybe you/we could/should/can..." — LEXICON.md §1 L6: "*maybe* is
  // scored separately as a downtoner since it falls outside the minimal
  // formula span." (The modal itself — could/should/can — is NOT listed:
  // that note says nothing about it, so it stays absorbed.)
  {
    directnessPatternSource: /\bmaybe (you|we) (could|should|can)\b/i.source,
    exemptModifierSubcategories: ["downtoner"],
  },
  // "Do you think you could...?" — LEXICON.md §1 L7: "two layers of
  // indirection, both separately downgraded."
  {
    directnessPatternSource: /\bdo you think you could\b/i.source,
    exemptModifierSubcategories: ["consultative", "syntactic.conditional"],
  },
  // "...just wanted to ask..." — LEXICON.md §1 L3: "*just* is separately
  // scored as a downgrader since it is not constitutive of the
  // performative."
  { directnessPatternSource: /\bjust wanted to ask\b/i.source, exemptModifierSubcategories: ["downtoner"] },
];

function isAbsorptionException(directnessEntry: LexEntry, modifierEntry: LexEntry): boolean {
  if (typeof directnessEntry.pattern === "string") return false;
  const source = directnessEntry.pattern.source;
  return ABSORPTION_EXCEPTIONS.some(
    (exception) =>
      exception.directnessPatternSource === source &&
      exception.exemptModifierSubcategories.includes(modifierEntry.subcategory),
  );
}

/**
 * SPEC.md §7.2 attachment (Prompt 5 final reconciliation): a modifier
 * attaches unconditionally only when it shares the SAME local segment as
 * the winning directness match (rule C below). A local segment is bounded
 * by comma, semicolon, em dash, or a contrastive "but" — SPEC.md/
 * LEXICON.md give no segmentation rule of their own; this is the
 * narrowest mechanical proxy for "different local clause" available
 * without a general parser, and it is intentionally more conservative
 * than the single-regex "different referent marker" this replaces (that
 * version keyed on explicit phrases like "on the other task"/"another
 * task", and missed cases with no marker word at all — e.g. "No rush on
 * payroll, but could you send this by 5?"). A modifier in a DIFFERENT
 * segment may still attach, but only if that segment, once every matched
 * modifier span AND harmless coordination ("and"/"but"/"so"/"also") is
 * removed, has no lexical/alphanumeric content left (rule D) — i.e. the
 * segment is standalone modifier material, not a competing clause with
 * its own referent. When a segment is not standalone, ALL modifiers in it
 * are left unassigned together, never partially — ambiguity resolves
 * toward non-attachment for that whole local unit, per "when uncertain,
 * leave the modifier unassigned rather than guessing."
 */
const LOCAL_SEGMENT_DELIMITER_RE = /[,;—]|\bbut\b/gi;

interface TextSegment {
  start: number;
  end: number;
  text: string;
}

/** Splits `text` at commas, semicolons, em dashes, and the word "but" (each delimiter itself excluded from the resulting segments). */
function splitIntoLocalSegments(text: string): TextSegment[] {
  const delimiter = new RegExp(LOCAL_SEGMENT_DELIMITER_RE.source, LOCAL_SEGMENT_DELIMITER_RE.flags);
  const segments: TextSegment[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = delimiter.exec(text)) !== null) {
    segments.push({ start: cursor, end: match.index, text: text.slice(cursor, match.index) });
    cursor = match.index + match[0].length;
  }
  segments.push({ start: cursor, end: text.length, text: text.slice(cursor) });
  return segments;
}

function findContainingSegment(segments: TextSegment[], position: number): TextSegment | undefined {
  return segments.find((s) => position >= s.start && position < s.end);
}

/**
 * SPEC.md §7.2 attachment: a text unit — a following sentence (zone B), or
 * a same-sentence local segment that doesn't hold the directness match
 * (zone A, rule D above) — counts as standalone modifier material only
 * when its content, once every matched modifier span and harmless
 * leftover (coordinating words, and bare speech-participant pronouns —
 * see below) are removed, is nothing but whitespace/punctuation.
 * `No rush.` and (in its own segment) bare `no rush` both qualify; `No
 * rush on the other task` / `No rush on payroll` / `No rush regarding
 * onboarding` do not, because "on the other task"/"on payroll"/
 * "regarding onboarding" all survive removal and name a different
 * referent — this is the general mechanical form of "does not introduce a
 * different request/task referent," not tied to any specific marker
 * phrase or vocabulary.
 *
 * Speech-participant pronouns (you/your/I/we/us/our/me/my) are stripped
 * alongside coordination because they are grammatical scaffolding around
 * a downgrader clause, not a competing referent: e.g. `Sorry to bother
 * you, but could you...` matches the downgraders.ts entry
 * `sorry to (bother|bug|ask|chase)` — the pattern itself stops before
 * "you" (it does not claim the pronoun as part of its span), so without
 * this allowance the addressee pronoun left over after removal would
 * wrongly read as "a different referent" and block a legitimate,
 * EVAL.md-covered softener. Third-person pronouns/demonstratives
 * (it/this/that/them) are deliberately NOT included — those are exactly
 * the words that plausibly point at a different task/thing, so they must
 * still disqualify a segment as non-standalone.
 */
function isStandaloneModifierUnit(unitText: string, matches: Array<{ span: Span }>): boolean {
  if (matches.length === 0) return false;
  const sorted = [...matches].sort((a, b) => a.span.start - b.span.start);
  let leftover = "";
  let cursor = 0;
  for (const m of sorted) {
    leftover += unitText.slice(cursor, m.span.start);
    cursor = Math.max(cursor, m.span.end);
  }
  leftover += unitText.slice(cursor);
  const withoutHarmlessContent = leftover.replace(/\b(?:and|but|so|also|you|your|i|we|us|our|me|my)\b/gi, "");
  return /^[\s.,!?;:—-]*$/.test(withoutHarmlessContent);
}

interface ModifierContribution {
  entry: LexEntry;
  span: Span;
  scale: number;
  contribution: number;
}

function deterministicId(messageId: string, category: EvidenceCategory, subcategory: string, span: Span): string {
  return `${messageId}:surface:${category}:${subcategory}:${span.start}-${span.end}`;
}

/**
 * Surface strength scorer (SPEC.md §7). `headAct` must have been produced
 * by `identifyHeadAct` against `message.text` — this function re-derives
 * the exact directness match via the same deterministic `matchDirectness`
 * scan rather than trusting `headAct.strategyName` blindly, so Evidence
 * spans are always reconstructed from the real text, never fabricated.
 */
export function scoreSurface(message: Message, headAct: HeadAct): SurfaceScore {
  const clauseA = message.text.slice(headAct.span.start, headAct.span.end);
  const directnessMatch = matchDirectness(clauseA);
  if (!directnessMatch) {
    throw new Error("scoreSurface: headAct.span does not contain a directness match — headAct was not produced by identifyHeadAct(message.text, ...)");
  }
  const level = DIRECTNESS_LEVEL_BY_SUBCATEGORY[directnessMatch.entry.subcategory];
  if (level === undefined) {
    throw new Error(`scoreSurface: unknown directness subcategory "${directnessMatch.entry.subcategory}"`);
  }

  const baseStrategy = directnessMatch.entry.weight * SURFACE_STRATEGY_SCALE;
  const directnessAbsSpan: Span = {
    start: headAct.span.start + directnessMatch.span.start,
    end: headAct.span.start + directnessMatch.span.end,
  };

  // ── Zone A: the head-act sentence itself, subject to overlap dedup, local-segment eligibility, and §0.2 absorption (SPEC.md §7.2). ──
  const zoneARaw = dedupeOverlappingModifiers([
    ...collectMatches(DOWNGRADERS, clauseA).map((m) => ({ ...m, scale: DOWNGRADER_SCALE })),
    ...collectMatches(UPGRADERS, clauseA).map((m) => ({ ...m, scale: UPGRADER_SCALE })),
  ]);

  // Local-segment eligibility (rules C/D): group by containing segment, then
  // decide per segment — the directness match's own segment is always
  // eligible; any other segment is eligible only as a whole (all-or-nothing)
  // when it is standalone modifier material.
  const localSegments = splitIntoLocalSegments(clauseA);
  const directnessSegment = findContainingSegment(localSegments, directnessMatch.span.start);

  const matchesBySegment = new Map<TextSegment, typeof zoneARaw>();
  for (const m of zoneARaw) {
    const seg = findContainingSegment(localSegments, m.span.start);
    if (!seg) continue;
    const list = matchesBySegment.get(seg) ?? [];
    list.push(m);
    matchesBySegment.set(seg, list);
  }

  const segmentEligible = new Set<(typeof zoneARaw)[number]>();
  for (const [seg, matchesInSeg] of matchesBySegment) {
    if (seg === directnessSegment) {
      for (const m of matchesInSeg) segmentEligible.add(m);
      continue;
    }
    const relativeMatches = matchesInSeg.map((m) => ({
      span: { start: m.span.start - seg.start, end: m.span.end - seg.start },
    }));
    if (isStandaloneModifierUnit(seg.text, relativeMatches)) {
      for (const m of matchesInSeg) segmentEligible.add(m);
    }
  }

  const zoneAMatches = zoneARaw.filter((m) => {
    if (!segmentEligible.has(m)) return false;
    const absSpan: Span = { start: headAct.span.start + m.span.start, end: headAct.span.start + m.span.end };
    const absorbed = absSpan.start >= directnessAbsSpan.start && absSpan.end <= directnessAbsSpan.end;
    // LEXICON.md §0.2 absorption rule, with its explicit exceptions: the
    // unconditional `you should` -> weak_deontic companion downgrader
    // (§0.3), and the narrow, note-derived ABSORPTION_EXCEPTIONS list
    // (Prompt 5 reconciliation).
    const absorptionExempt =
      m.entry.subcategory === "syntactic.weak_deontic" || isAbsorptionException(directnessMatch.entry, m.entry);
    return !absorbed || absorptionExempt;
  });

  // ── Zone B: the immediately following sentence, only if it is a standalone modifier formula (SPEC.md §7.2). ──
  const sentences = segmentSentences(message.text);
  const headActIndex = sentences.findIndex((s) => s.start === headAct.span.start && s.end === headAct.span.end);
  const nextSentence = headActIndex === -1 ? undefined : sentences[headActIndex + 1];

  let zoneBMatches: Array<{ entry: LexEntry; span: Span; scale: number }> = [];
  let zoneBSpan: Span | undefined;
  if (nextSentence) {
    const clauseB = message.text.slice(nextSentence.start, nextSentence.end);
    const candidateMatches = dedupeOverlappingModifiers([
      ...collectMatches(DOWNGRADERS, clauseB).map((m) => ({ ...m, scale: DOWNGRADER_SCALE })),
      ...collectMatches(UPGRADERS, clauseB).map((m) => ({ ...m, scale: UPGRADER_SCALE })),
    ]);
    if (isStandaloneModifierUnit(clauseB, candidateMatches)) {
      zoneBMatches = candidateMatches;
      zoneBSpan = nextSentence;
    }
  }

  const contributions: ModifierContribution[] = [
    ...zoneAMatches.map((m) => ({
      entry: m.entry,
      span: { start: headAct.span.start + m.span.start, end: headAct.span.start + m.span.end },
      scale: m.scale,
      contribution: m.entry.weight * m.scale,
    })),
    ...(zoneBSpan
      ? zoneBMatches.map((m) => ({
          entry: m.entry,
          span: { start: zoneBSpan.start + m.span.start, end: zoneBSpan.start + m.span.end },
          scale: m.scale,
          contribution: m.entry.weight * m.scale,
        }))
      : []),
  ];

  const uncappedAggregate = contributions.reduce((sum, c) => sum + c.contribution, 0);
  const modifierDelta = clamp(uncappedAggregate, -MODIFIER_DELTA_CLAMP, MODIFIER_DELTA_CLAMP);
  const surface = clamp(baseStrategy + modifierDelta, SURFACE_MIN, SURFACE_MAX);
  const effectiveModifierDelta = surface - baseStrategy;

  // Task 7 cap bookkeeping: this rescaling reconstructs, per-Evidence, the
  // already-canonical aggregate score computed above — it is NOT a new
  // linguistic weighting rule. rawWeight is never touched.
  const capApplied = Math.abs(uncappedAggregate - effectiveModifierDelta) > CLAMP_EPSILON;
  const rescaleFactor = capApplied && uncappedAggregate !== 0 ? effectiveModifierDelta / uncappedAggregate : 1;

  const evidence: Evidence[] = [];

  evidence.push({
    id: deterministicId(message.id, "directness", directnessMatch.entry.subcategory, directnessAbsSpan),
    scorer: "surface",
    category: "directness",
    subcategory: directnessMatch.entry.subcategory,
    trigger: message.text.slice(directnessAbsSpan.start, directnessAbsSpan.end),
    span: directnessAbsSpan,
    messageId: message.id,
    rawWeight: directnessMatch.entry.weight,
    weight: baseStrategy,
    capped: false,
    eventId: deterministicId(message.id, "directness", directnessMatch.entry.subcategory, directnessAbsSpan),
    note: directnessMatch.entry.note,
    citation: "LEXICON.md §1",
  });

  for (const c of contributions) {
    const weight = capApplied && uncappedAggregate !== 0 ? c.contribution * rescaleFactor : c.contribution;
    const citation = c.entry.category === "downgrader" ? "LEXICON.md §2" : "LEXICON.md §3";
    evidence.push({
      id: deterministicId(message.id, c.entry.category, c.entry.subcategory, c.span),
      scorer: "surface",
      category: c.entry.category,
      subcategory: c.entry.subcategory,
      trigger: message.text.slice(c.span.start, c.span.end),
      span: c.span,
      messageId: message.id,
      rawWeight: c.entry.weight,
      weight,
      capped: capApplied,
      eventId: deterministicId(message.id, c.entry.category, c.entry.subcategory, c.span),
      note: c.entry.note,
      citation,
    });
  }

  return { value: surface, ccsarpLevel: level, evidence };
}
