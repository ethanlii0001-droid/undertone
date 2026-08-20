/**
 * Deadline specificity and proximity reasoning for the force scorer, per
 * SPEC.md §9. Implements the temporal ladder (LEXICON.md §4: highest rung
 * that fires wins, not first-hit), dynamic today/EOD/COB resolution
 * against MaskedMessage.timestamp and an explicit business-day config
 * (SPEC.md §9.1), past-due handling (SPEC.md §9.2), and the deterministic
 * proximityBonus curve (SPEC.md §9.3: MAX * exp(-hoursRemaining / TAU),
 * capped at MAX = 1.5, HORIZON = 336h).
 *
 * Reads only timestamps supplied in the input and the explicit `Config` —
 * never `Date.now()` or the runtime timezone (CLAUDE.md rule 1). All date
 * arithmetic below derives its "today"/"weekday" fields from the supplied
 * ISO timestamp's own UTC offset, by shifting the instant by that offset
 * and reading UTC getters — never the host machine's local timezone.
 *
 * Only evaluates `MaskedMessage.maskedText` — never raw Message text
 * (SPEC.md §10, §10.1).
 */
import type { Config, Evidence, EvidenceCategory, LexEntry, MaskedMessage, Span } from "../types.js";
import { segmentSentences } from "../segment.js";
import {
  TEMPORAL_ENTRIES_BY_RUNG,
  TEMPORAL_RUNGS,
  TEMPORAL_RUNG_ORDER,
  TEMPORAL_SCALE,
  type TemporalRung,
} from "../lexicons/temporal.js";

// ---------------------------------------------------------------------------
// proximityBonus constants (SPEC.md §9.3) — named, never inlined.
// ---------------------------------------------------------------------------

/** Maximum proximity bonus, applied for an already-past-due deadline (h <= 0). SPEC.md §9.3. */
export const PROXIMITY_MAX = 1.5;
/** Exponential decay time constant, in hours. SPEC.md §9.3. */
export const PROXIMITY_TAU_HOURS = 48;
/** Beyond this many hours remaining, proximity is 0. SPEC.md §9.3. */
export const PROXIMITY_HORIZON_HOURS = 336;

/** Fallback business-day-end wall-clock time when `Config.businessDayEnd` is omitted (SPEC.md §9.1). */
const DEFAULT_DAY_END = { hour: 23, minute: 59 };

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tues: 2, tue: 2,
  wednesday: 3, wednes: 3, wed: 3,
  thursday: 4, thurs: 4, thu: 4,
  friday: 5, fri: 5,
  saturday: 6, satur: 6, sat: 6,
};
const MONTH_INDEX: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};
/** The exact non-numeric quantity words LEXICON.md's "within (the next) N/a few/two/three days/hours/weeks" relative-rung entry recognizes (Prompt 6R-C Task 4) — not a general number-word parser. */
const WITHIN_UNIT_WORD_NUMBERS: Record<string, number> = { "a few": 3, two: 2, three: 3 };

// ---------------------------------------------------------------------------
// Offset-preserving instant arithmetic. All derived from the supplied ISO
// timestamp string's own offset — never the runtime clock/timezone.
// ---------------------------------------------------------------------------

interface Instant {
  epochMs: number;
  /** Minutes east of UTC, e.g. -240 for "-04:00". */
  offsetMinutes: number;
}

function parseOffsetMinutes(timestamp: string): number {
  if (timestamp.endsWith("Z")) return 0;
  const match = /([+-])(\d{2}):(\d{2})$/.exec(timestamp);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

function parseInstant(timestamp: string): Instant {
  return { epochMs: Date.parse(timestamp), offsetMinutes: parseOffsetMinutes(timestamp) };
}

interface LocalFields {
  year: number;
  month: number; // 0-based
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0 = Sunday .. 6 = Saturday
}

/** The instant's own wall-clock fields, in its own offset — not the host machine's local timezone. */
function localFields(instant: Instant): LocalFields {
  const shifted = new Date(instant.epochMs + instant.offsetMinutes * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    weekday: shifted.getUTCDay(),
  };
}

/** Builds an instant from explicit local wall-clock fields plus the offset they're expressed in. */
function makeInstant(year: number, month: number, day: number, hour: number, minute: number, offsetMinutes: number): Instant {
  return { epochMs: Date.UTC(year, month, day, hour, minute, 0) - offsetMinutes * 60_000, offsetMinutes };
}

function addDays(instant: Instant, days: number): Instant {
  const f = localFields(instant);
  return makeInstant(f.year, f.month, f.day + days, f.hour, f.minute, instant.offsetMinutes);
}

function addMinutes(instant: Instant, minutes: number): Instant {
  return { epochMs: instant.epochMs + minutes * 60_000, offsetMinutes: instant.offsetMinutes };
}

function atTimeOfDay(instant: Instant, hour: number, minute: number): Instant {
  const f = localFields(instant);
  return makeInstant(f.year, f.month, f.day, hour, minute, instant.offsetMinutes);
}

function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? "-" : "+";
  const abs = Math.abs(offsetMinutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

function formatInstant(instant: Instant): string {
  const f = localFields(instant);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${f.year}-${pad(f.month + 1)}-${pad(f.day)}T${pad(f.hour)}:${pad(f.minute)}:${pad(f.second)}${formatOffset(instant.offsetMinutes)}`;
}

function hoursBetween(a: Instant, b: Instant): number {
  return (b.epochMs - a.epochMs) / 3_600_000;
}

/** The wall-clock end-of-business-day instant on `instant`'s own calendar day, from `Config.businessDayEnd` or the SPEC.md §9.1 23:59 fallback. */
function businessDayEndOn(instant: Instant, config: Config | undefined): Instant {
  const configured = config?.businessDayEnd;
  if (configured) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(configured);
    if (match) return atTimeOfDay(instant, Number(match[1]), Number(match[2]));
  }
  return atTimeOfDay(instant, DEFAULT_DAY_END.hour, DEFAULT_DAY_END.minute);
}

/**
 * True when `businessDayEndOn` above would fall back to the SPEC.md §9.1
 * same-offset 23:59 default because `Config.businessDayEnd` was omitted
 * (or malformed) — mirrors that function's own fallback condition exactly,
 * without changing its return shape. Used only to make the fallback
 * visible in Evidence.note for the dynamic today/EOD/COB resolutions
 * (Prompt 6R-A Task A) — kept as its own named predicate, separate from
 * the unrelated numeric-date locale assumption (`ResolvedDeadline.assumed`
 * below), so the two assumption kinds are never conflated in one note.
 */
function isBusinessDayEndAssumed(config: Config | undefined): boolean {
  const configured = config?.businessDayEnd;
  return !(configured && /^\d{1,2}:\d{2}$/.test(configured));
}

/** The exact, explicit assumption statement Task A requires whenever the 23:59 fallback was used. */
const BUSINESS_DAY_END_ASSUMPTION_NOTE =
  "ASSUMPTION: Config.businessDayEnd was omitted, so this resolved against the same-offset local 23:59 fallback (SPEC.md §9.1), not a configured business-day end.";

/** Next occurrence of `targetWeekday` (0=Sun..6=Sat) at/after `from`, per `mode`. */
function nextWeekday(from: Instant, targetWeekday: number, mode: "including-today" | "strictly-next-week"): Instant {
  const f = localFields(from);
  let delta = (targetWeekday - f.weekday + 7) % 7;
  if (mode === "strictly-next-week" && delta === 0) delta = 7;
  return addDays(from, delta);
}

/** Most recent PAST occurrence of `targetWeekday`, strictly before `from`'s calendar day. */
function mostRecentPastWeekday(from: Instant, targetWeekday: number): Instant {
  const f = localFields(from);
  let delta = (f.weekday - targetWeekday + 7) % 7;
  if (delta === 0) delta = 7;
  return addDays(from, -delta);
}

// ---------------------------------------------------------------------------
// Rung matching
// ---------------------------------------------------------------------------

interface RungMatch {
  rung: TemporalRung;
  entry: LexEntry;
  span: Span;
}

/** Scans every sentence of `maskedText` against every static rung array, returning every match found (LEXICON.md §0.4 rule 2: never across a sentence boundary). */
function findStaticRungMatches(maskedText: string): RungMatch[] {
  const matches: RungMatch[] = [];
  for (const sentenceSpan of segmentSentences(maskedText)) {
    const clause = maskedText.slice(sentenceSpan.start, sentenceSpan.end);
    for (const rung of TEMPORAL_RUNG_ORDER) {
      for (const entry of TEMPORAL_ENTRIES_BY_RUNG[rung]) {
        if (typeof entry.pattern === "string") continue;
        const match = entry.pattern.exec(clause);
        if (!match) continue;
        matches.push({
          rung,
          entry,
          span: { start: sentenceSpan.start + match.index, end: sentenceSpan.start + match.index + match[0].length },
        });
      }
    }
  }
  return matches;
}

/** Word immediately preceding `index` in `text`, used to detect a weekday prefix before bare EOD/COB/today (LEXICON.md §4's dynamic-EOD/COB rule). */
function precedingWordMatches(text: string, index: number, re: RegExp): boolean {
  const before = text.slice(Math.max(0, index - 12), index);
  return re.test(before);
}

const WEEKDAY_PREFIX_RE = /(?:mon|tues|wednes|thurs|fri|satur|sun)day\s*$/i;

/**
 * Dynamic `today`/bare-EOD/bare-COB candidates (LEXICON.md §4 "Dynamic
 * EOD/COB resolution" and "Dynamic today resolution"; SPEC.md §9.1).
 * `Friday EOD`/weekday-qualified forms are excluded here (already matched
 * by the static date_time rung) so a future `Friday EOD` cannot be
 * misread as same-day immediate merely because it contains `EOD`.
 */
function findDynamicCandidates(maskedText: string, messageInstant: Instant, config: Config | undefined): RungMatch[] {
  const results: RungMatch[] = [];
  const dayEnd = businessDayEndOn(messageInstant, config);
  const hoursRemaining = hoursBetween(messageInstant, dayEnd);
  const dynamicRung: TemporalRung = hoursRemaining > 6 ? "named_day" : hoursRemaining >= 2 ? "date_time" : "immediate";
  const dynamicWeight = TEMPORAL_RUNGS[dynamicRung];
  const assumptionSuffix = isBusinessDayEndAssumed(config) ? ` ${BUSINESS_DAY_END_ASSUMPTION_NOTE}` : "";

  const dynamicEntry = (subcategory: string, note: string): LexEntry => ({
    pattern: /(?:)/,
    weight: dynamicWeight,
    category: "temporal",
    subcategory,
    note: `${note}${assumptionSuffix}`,
  });

  for (const sentenceSpan of segmentSentences(maskedText)) {
    const clause = maskedText.slice(sentenceSpan.start, sentenceSpan.end);

    const todayRe = /\btoday\b/gi;
    let m: RegExpExecArray | null;
    while ((m = todayRe.exec(clause)) !== null) {
      results.push({
        rung: dynamicRung,
        entry: dynamicEntry(
          "today.dynamic",
          `Dynamic "today" resolution (SPEC.md §9.1): ${hoursRemaining.toFixed(2)}h remain to business-day-end, resolving to the ${dynamicRung} rung.`,
        ),
        span: { start: sentenceSpan.start + m.index, end: sentenceSpan.start + m.index + m[0].length },
      });
    }

    const eodCobRe = /\b(EOD|COB)\b/gi;
    while ((m = eodCobRe.exec(clause)) !== null) {
      const absIndex = sentenceSpan.start + m.index;
      if (precedingWordMatches(maskedText, absIndex, WEEKDAY_PREFIX_RE)) continue;
      results.push({
        rung: dynamicRung,
        entry: dynamicEntry(
          "eod_cob.dynamic",
          `Dynamic bare "${m[0]}" resolution (LEXICON.md §4): resolves against same-day business-day-end since no explicit future weekday/date modifies it; ${hoursRemaining.toFixed(2)}h remain, resolving to the ${dynamicRung} rung.`,
        ),
        span: { start: absIndex, end: absIndex + m[0].length },
      });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Instant resolution for the winning match
// ---------------------------------------------------------------------------

export interface ResolvedDeadline {
  resolvedAt: string | null;
  /** True when resolution required assuming a locale convention for an ambiguous numeric date (e.g. MM/DD/YYYY) — unrelated to `businessDayEndAssumed` below; the two assumption kinds are never conflated in one note (Prompt 6R-A Task A). */
  assumed: boolean;
  /** True when this resolution used the SPEC.md §9.1 same-offset 23:59 fallback because `Config.businessDayEnd` was omitted — set only by the dynamic today/EOD/COB branch (Prompt 6R-A Task A's scope). */
  businessDayEndAssumed?: boolean;
  /** Prompt 6R-F Task 3: overrides the generic "no calendar instant could be resolved" proximity note with a specific, documented reason `resolvedAt` was deliberately left null — used for cases like "start of business Monday", where `Config` simply has no field to resolve against, as opposed to a rung that merely names no date at all. */
  unresolvedReason?: string;
}

/**
 * Resolves the winning temporal match's trigger text to an instant, using
 * only `messageInstant` and `Config` (never runtime locale/clock). Returns
 * `resolvedAt: null` when resolution would require inventing a calendar
 * assumption the canonical docs don't license (SPEC.md/this prompt's Task
 * 3G) — e.g. `this sprint`, `before the standup`, `already overdue` with
 * no named date. This is a targeted resolver for the trigger shapes that
 * actually occur in the canonical lexicon, not a general date parser.
 */
function resolveInstant(trigger: string, subcategory: string, messageInstant: Instant, config: Config | undefined): ResolvedDeadline {
  const text = trigger.toLowerCase();
  const dayEnd = (at: Instant) => businessDayEndOn(at, config);

  // Already-past forms (LEXICON.md §4 already_past subcategory).
  if (subcategory === "already_past") {
    const weekdayMatch = Object.keys(WEEKDAY_INDEX).find((name) => new RegExp(`\\b${name}\\b`).test(text));
    if (weekdayMatch) {
      return { resolvedAt: formatInstant(dayEnd(mostRecentPastWeekday(messageInstant, WEEKDAY_INDEX[weekdayMatch] as number))), assumed: false };
    }
    if (/\byesterday\b/.test(text)) {
      return { resolvedAt: formatInstant(dayEnd(addDays(messageInstant, -1))), assumed: false };
    }
    // "needed an hour ago" (Prompt 6R-F Task 2): a reproducibly resolvable past point —
    // messageInstant - 1h — unlike "already overdue" below, which names no specific date.
    if (/\ban hour ago\b/.test(text)) {
      return { resolvedAt: formatInstant(addMinutes(messageInstant, -60)), assumed: false };
    }
    // "overdue since Aug 15" / "overdue since August 15" (Prompt 6R-F Task 2): month-name +
    // day is reproducibly resolvable. Resolve within the current calendar year; if that would
    // place the stated date in the future relative to messageInstant, the interval could not
    // actually have been "overdue" yet under that reading, so use the previous year instead.
    const overdueMonthDay = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})\b/.exec(text);
    if (overdueMonthDay) {
      const f = localFields(messageInstant);
      const month = MONTH_INDEX[overdueMonthDay[1] as string] as number;
      const day = Number(overdueMonthDay[2]);
      let year = f.year;
      let at = makeInstant(year, month, day, 0, 0, messageInstant.offsetMinutes);
      if (hoursBetween(messageInstant, dayEnd(at)) > 0) {
        year -= 1;
        at = makeInstant(year, month, day, 0, 0, messageInstant.offsetMinutes);
      }
      return { resolvedAt: formatInstant(dayEnd(at)), assumed: false };
    }
    // "already overdue" names no specific date at all — LEXICON.md's own note on
    // `already overdue` explicitly allows "maximum rung, unresolved timestamp allowed".
    return { resolvedAt: null, assumed: false };
  }

  // Dynamic today / bare EOD / COB — resolved by the caller already carrying the right rung;
  // here we just need the actual instant.
  if (subcategory === "today.dynamic" || subcategory === "eod_cob.dynamic") {
    return {
      resolvedAt: formatInstant(dayEnd(messageInstant)),
      assumed: false,
      businessDayEndAssumed: isBusinessDayEndAssumed(config),
    };
  }

  // "first thing tomorrow/monday/in the morning" (LEXICON.md §4 immediate rung) names no
  // resolvable clock time at all — there is no canonical instant for "first thing" (Prompt
  // 6R-C Task 1). Checked before the weekday/tomorrow branches below on purpose: without this
  // early exit, "first thing Monday" would fall into the weekday branch and "first thing
  // tomorrow" into the tomorrow branch, each silently inventing an instant (business-day-end
  // or a fixed hour) that no canonical source licenses. The lexical immediate rung itself is
  // untouched — only resolution stops here, leaving resolvedAt null and proximity 0.
  if (/\bfirst thing\b/.test(text)) {
    return { resolvedAt: null, assumed: false };
  }

  // "start of business Monday" / "start of play Monday" (Prompt 6R-F Task 3): `Config` has no
  // business-day-START field (only `businessDayEnd`, SPEC.md §9.1), so there is no canonical
  // instant to resolve this against. Checked before the weekday branch below, which would
  // otherwise silently resolve it to that weekday's business-day END — the wrong instant, not
  // merely an unresolved one. The date_time lexical rung itself is untouched; only resolution
  // is withheld.
  if (/\bstart of (?:play|business) (?:mon|tues|wednes|thurs|fri|satur|sun)day\b/.test(text)) {
    return {
      resolvedAt: null,
      assumed: false,
      unresolvedReason:
        'Deadline rung matched but Config has no business-day-start field (SPEC.md §9.1 defines only a business-day END), so no "start of business/play" instant was invented; proximity bonus is 0.',
    };
  }

  // ISO date: YYYY-MM-DD, optionally with a clock time elsewhere in the trigger (none in this lexicon's own span, so use day-end).
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text);
  if (iso) {
    const at = makeInstant(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 0, 0, messageInstant.offsetMinutes);
    return { resolvedAt: formatInstant(dayEnd(at)), assumed: false };
  }

  // Numeric date: locale-ambiguous (LEXICON.md's own note) — assumed MM/DD/YYYY, flagged assumed: true.
  const numeric = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(text);
  if (numeric) {
    const f = localFields(messageInstant);
    const month = Number(numeric[1]) - 1;
    const day = Number(numeric[2]);
    const year = numeric[3] ? (numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3])) : f.year;
    const at = makeInstant(year, month, day, 0, 0, messageInstant.offsetMinutes);
    return { resolvedAt: formatInstant(dayEnd(at)), assumed: true };
  }

  // Month name + day: "Aug 15", "August 15".
  const monthDay = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})\b/.exec(text);
  if (monthDay) {
    const f = localFields(messageInstant);
    const at = makeInstant(f.year, MONTH_INDEX[monthDay[1] as string] as number, Number(monthDay[2]), 0, 0, messageInstant.offsetMinutes);
    return { resolvedAt: formatInstant(dayEnd(at)), assumed: false };
  }

  // Ordinal day-of-month, no month named: "the 15th" — resolve within the current month, rolling to next month if already passed.
  const ordinal = /\bthe (\d{1,2})(?:st|nd|rd|th)\b/.exec(text);
  if (ordinal) {
    const f = localFields(messageInstant);
    let at = makeInstant(f.year, f.month, Number(ordinal[1]), 0, 0, messageInstant.offsetMinutes);
    if (hoursBetween(messageInstant, dayEnd(at)) < 0) at = makeInstant(f.year, f.month + 1, Number(ordinal[1]), 0, 0, messageInstant.offsetMinutes);
    return { resolvedAt: formatInstant(dayEnd(at)), assumed: false };
  }

  // Weekday + explicit clock time: "Monday at 9am", "Thursday 3pm", "3pm on Friday".
  const weekdayName = Object.keys(WEEKDAY_INDEX).find((name) => new RegExp(`\\b${name}\\b`).test(text));
  const clockTime = /\b(\d{1,2})(?::(\d{2}))?\s?(am|pm)?\b/.exec(text.replace(/\b\d{1,2}(st|nd|rd|th)\b/g, ""));

  if (weekdayName) {
    const isThis = /\bthis\s+\w+\b/.test(text) && !/\bnext\s+\w+\b/.test(text);
    const isNext = /\bnext\s+\w+\b/.test(text);
    const target = nextWeekday(messageInstant, WEEKDAY_INDEX[weekdayName] as number, isNext ? "strictly-next-week" : "including-today");
    const base = isThis && !isNext ? nextWeekday(messageInstant, WEEKDAY_INDEX[weekdayName] as number, "including-today") : target;
    if (clockTime && clockTime[3]) {
      const hour24 = toHour24(Number(clockTime[1]), clockTime[3]);
      return { resolvedAt: formatInstant(atTimeOfDay(base, hour24, clockTime[2] ? Number(clockTime[2]) : 0)), assumed: false };
    }
    return { resolvedAt: formatInstant(dayEnd(base)), assumed: false };
  }

  // "tomorrow" / "day after tomorrow".
  if (/\bday after tomorrow\b/.test(text)) return { resolvedAt: formatInstant(dayEnd(addDays(messageInstant, 2))), assumed: false };
  if (/\btomorrow\b/.test(text)) {
    return { resolvedAt: formatInstant(dayEnd(addDays(messageInstant, 1))), assumed: false };
  }

  // Explicit clock time with no day named: today at that time, rolling to tomorrow if already past.
  const bareClockTime = /\b(\d{1,2})(?::(\d{2}))?\s?(am|pm)\b/.exec(text);
  if (bareClockTime) {
    const hour24 = toHour24(Number(bareClockTime[1]), bareClockTime[3] as string);
    let at = atTimeOfDay(messageInstant, hour24, bareClockTime[2] ? Number(bareClockTime[2]) : 0);
    if (hoursBetween(messageInstant, at) < 0) at = addDays(at, 1);
    return { resolvedAt: formatInstant(at), assumed: false };
  }
  if (/\bnoon\b/.test(text)) {
    let at = atTimeOfDay(messageInstant, 12, 0);
    if (hoursBetween(messageInstant, at) < 0) at = addDays(at, 1);
    return { resolvedAt: formatInstant(at), assumed: false };
  }

  // Sub-hour/immediate windows, resolved as an offset from the message timestamp itself.
  if (/\bnow\b/.test(text) || /\bright (now|away)\b/.test(text) || /\bimmediately\b/.test(text) || /\basap\b/.test(text)) {
    return { resolvedAt: formatInstant(messageInstant), assumed: false };
  }
  // "within N minutes" / "in N minutes" (Prompt 6R-F Task 1): LEXICON.md's immediate-rung
  // entry canonically recognizes both `(?:within|in)` surface forms; the resolver must match
  // the same pair so "in 20 minutes" doesn't silently fall through to an unresolved instant.
  const withinOrInMinutes = /\b(?:within|in) (\d{1,2}) minutes?\b/.exec(text);
  if (withinOrInMinutes) return { resolvedAt: formatInstant(addMinutes(messageInstant, Number(withinOrInMinutes[1]))), assumed: false };
  if (/\bwithin the hour\b/.test(text) || /\bin the next hour\b/.test(text)) return { resolvedAt: formatInstant(addMinutes(messageInstant, 60)), assumed: false };
  if (/\bin the next (30 minutes|half hour)\b/.test(text)) return { resolvedAt: formatInstant(addMinutes(messageInstant, 30)), assumed: false };

  // Bounded relative windows: "within (the next) N/a few/two/three days/hours/weeks" — the
  // same numeral/number-word range LEXICON.md's own relative-rung entry recognizes (Prompt
  // 6R-C Task 4), "this week", "next week".
  const withinUnit = /\bwithin (?:the next )?(\d+|a few|two|three) (days|hours|weeks)\b/.exec(text);
  if (withinUnit) {
    const rawAmount = withinUnit[1] as string;
    const n = /^\d+$/.test(rawAmount) ? Number(rawAmount) : (WITHIN_UNIT_WORD_NUMBERS[rawAmount] as number);
    const hours = withinUnit[2] === "hours" ? n : withinUnit[2] === "days" ? n * 24 : n * 24 * 7;
    return { resolvedAt: formatInstant(addMinutes(messageInstant, hours * 60)), assumed: false };
  }
  if (/\bthis week\b/.test(text)) return { resolvedAt: formatInstant(dayEnd(nextWeekday(messageInstant, 5, "including-today"))), assumed: false };
  if (/\bnext week\b/.test(text)) return { resolvedAt: formatInstant(dayEnd(addDays(nextWeekday(messageInstant, 5, "including-today"), 7))), assumed: false };
  if (/\bend of (the )?week\b/.test(text) || /\beow\b/.test(text)) return { resolvedAt: formatInstant(dayEnd(nextWeekday(messageInstant, 5, "including-today"))), assumed: false };
  if (/\bend of (the )?month\b/.test(text)) {
    const f = localFields(messageInstant);
    const lastDay = new Date(Date.UTC(f.year, f.month + 1, 0)).getUTCDate();
    return { resolvedAt: formatInstant(dayEnd(makeInstant(f.year, f.month, lastDay, 0, 0, messageInstant.offsetMinutes))), assumed: false };
  }
  if (/\bend of (the )?quarter\b/.test(text)) {
    const f = localFields(messageInstant);
    const quarterEndMonth = Math.floor(f.month / 3) * 3 + 2; // 0-based: Feb(2), May(5), Aug(8), Nov(11)
    const lastDay = new Date(Date.UTC(f.year, quarterEndMonth + 1, 0)).getUTCDate();
    return { resolvedAt: formatInstant(dayEnd(makeInstant(f.year, quarterEndMonth, lastDay, 0, 0, messageInstant.offsetMinutes))), assumed: false };
  }

  // No reproducible calendar resolution available (e.g. "this sprint", "before the standup",
  // "ahead of the meeting") — SPEC.md/Task 3G explicitly allow retaining the rung without a resolved instant.
  return { resolvedAt: null, assumed: false };
}

function toHour24(hour12: number, meridiem: string): number {
  const h = hour12 % 12;
  return meridiem.toLowerCase() === "pm" ? h + 12 : h;
}

// ---------------------------------------------------------------------------
// proximityBonus (SPEC.md §9.3)
// ---------------------------------------------------------------------------

/**
 * Additive bonus applied to the temporal component after rung scaling
 * (SPEC.md §9.3). Deterministic: uses only the resolved deadline and the
 * message timestamp, never the wall clock (CLAUDE.md rule 1).
 */
export function proximityBonus(resolvedAt: string | null, messageTimestamp: string): number {
  if (resolvedAt === null) return 0;
  const h = hoursBetween(parseInstant(messageTimestamp), parseInstant(resolvedAt));
  if (h <= 0) return PROXIMITY_MAX;
  if (h >= PROXIMITY_HORIZON_HOURS) return 0;
  return PROXIMITY_MAX * Math.exp(-h / PROXIMITY_TAU_HOURS);
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

function deterministicId(messageId: string, category: EvidenceCategory, subcategory: string, span: Span): string {
  return `${messageId}:force:${category}:${subcategory}:${span.start}-${span.end}`;
}

/**
 * Finds the single best temporal deadline description in `masked.maskedText`
 * (LEXICON.md §4: highest rung wins, earliest span breaks a same-rung tie,
 * canonical array order breaks a same-offset tie) and returns its rung
 * Evidence plus a `temporal.proximity` Evidence sharing the same eventId
 * (SPEC.md §9.3, §11.2's explicit same-event exception for this pair).
 * Returns `[]` when no temporal expression matches at all.
 */
export function scoreTemporal(masked: MaskedMessage, config?: Config): Evidence[] {
  const messageInstant = parseInstant(masked.timestamp);
  const staticMatches = findStaticRungMatches(masked.maskedText);
  const dynamicMatches = findDynamicCandidates(masked.maskedText, messageInstant, config);
  const all = [...staticMatches, ...dynamicMatches];
  if (all.length === 0) return [];

  let best: RungMatch | null = null;
  let bestRungWeight = -1;
  for (const candidate of all) {
    const weight = TEMPORAL_RUNGS[candidate.rung];
    if (
      best === null ||
      weight > bestRungWeight ||
      (weight === bestRungWeight && candidate.span.start < best.span.start)
    ) {
      best = candidate;
      bestRungWeight = weight;
    }
  }
  // A "none" rung match (e.g. "no deadline") legitimately wins and is still surfaced as
  // evidence that the absence was explicit, not merely inferred — it contributes 0 either way.
  const winner = best as RungMatch;

  const trigger = masked.maskedText.slice(winner.span.start, winner.span.end);
  const resolved = resolveInstant(trigger, winner.entry.subcategory, messageInstant, config);
  const eventId = deterministicId(masked.messageId, "temporal", winner.entry.subcategory, winner.span);

  const rawWeight = TEMPORAL_RUNGS[winner.rung];
  const rungNote = resolved.assumed
    ? `${winner.entry.note} ASSUMPTION: numeric date interpreted as MM/DD/YYYY — locale not supplied.`
    : winner.entry.note;

  const evidence: Evidence[] = [
    {
      id: deterministicId(masked.messageId, "temporal", winner.entry.subcategory, winner.span),
      scorer: "force",
      category: "temporal",
      subcategory: winner.entry.subcategory,
      trigger,
      span: winner.span,
      messageId: masked.messageId,
      rawWeight,
      weight: rawWeight * TEMPORAL_SCALE,
      capped: false,
      eventId,
      note: rungNote,
      citation: "LEXICON.md §4",
    },
  ];

  const proximity = proximityBonus(resolved.resolvedAt, masked.timestamp);
  const h = resolved.resolvedAt === null ? null : hoursBetween(messageInstant, parseInstant(resolved.resolvedAt));
  const businessDayEndSuffix = resolved.businessDayEndAssumed ? ` ${BUSINESS_DAY_END_ASSUMPTION_NOTE}` : "";
  const proximityNote =
    resolved.resolvedAt === null
      ? (resolved.unresolvedReason ??
        "Deadline rung matched but no calendar instant could be resolved without inventing a locale/schedule assumption Config does not supply; proximity bonus is 0 (SPEC.md §9.3).")
      : `deadline resolves to ${resolved.resolvedAt}, ${(h as number).toFixed(2)}h after this message${businessDayEndSuffix}`;

  evidence.push({
    id: deterministicId(masked.messageId, "temporal", "temporal.proximity", winner.span),
    scorer: "force",
    category: "temporal",
    subcategory: "temporal.proximity",
    trigger,
    span: winner.span,
    messageId: masked.messageId,
    rawWeight: proximity,
    weight: proximity,
    capped: false,
    eventId,
    note: proximityNote,
    citation: "SPEC.md §9.3",
  });

  return evidence;
}
