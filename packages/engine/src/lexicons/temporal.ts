/**
 * Deadline specificity ladder — none / vague / relative / named_day /
 * date_time / immediate — with raw weights, dynamic today/EOD/COB
 * resolution rules, and the proximityBonus formula, per LEXICON.md §4.
 * Feeds the force scorer only.
 *
 * Transcribed verbatim from LEXICON.md §4 — pattern, weight, category,
 * subcategory, and note are copied as specified, including entries marked
 * "**Uncertain**" in their own note. Do not tune weights or patterns here;
 * fix LEXICON.md instead if an entry is wrong.
 *
 * No pattern here may ever be evaluated against unmasked text (LEXICON.md
 * §0.4 rule 5; SPEC.md §10).
 */
import type { LexEntry } from "../types.js";

/**
 * Force-side normalization constant applied to every temporal rung's raw
 * weight (LEXICON.md §0.1 `SCALE.temporal`). Raw weights are unsigned
 * salience magnitudes on the 0–5.0 rung scale; this constant supplies the
 * scale of a matched rung's contribution (temporal contributions are never
 * negative — there are no force mitigators, SPEC.md §8).
 */
export const TEMPORAL_SCALE = 0.6;

export type TemporalRung = "none" | "vague" | "relative" | "named_day" | "date_time" | "immediate";

export const TEMPORAL_RUNGS: Record<TemporalRung, number> = {
  none: 0, vague: 0.5, relative: 1.5, named_day: 3.0, date_time: 4.0, immediate: 5.0,
};

export const TEMPORAL_NONE: LexEntry[] = [
  { pattern: /\bno (hard |fixed |firm )?(deadline|date)\b/i, weight: 0, category: "temporal", subcategory: "none.explicit", note: "Explicitly asserts the absence of a deadline; scored at zero rather than negatively because the absence of pressure is the ladder's baseline, not a mitigator." },
  { pattern: /\bopen[- ]ended\b/i, weight: 0, category: "temporal", subcategory: "none.explicit", note: "Names the task as unbounded in time; same baseline reasoning." },
  { pattern: /\bnot time[- ]sensitive\b/i, weight: 0, category: "temporal", subcategory: "none.explicit", note: "Negated temporal sensitivity; explicit denial that timing matters." },
  { pattern: /\bno timeline (on this|yet)\b/i, weight: 0, category: "temporal", subcategory: "none.explicit", note: "Asserts that no schedule has been set; common in early-stage project threads." },
  { pattern: /\bbacklog(ged)?\b/i, weight: 0, category: "temporal", subcategory: "none.explicit", note: "Places the task in an unscheduled queue; a structural rather than lexical assertion of no deadline." },
  { pattern: /\bnice to have\b/i, weight: 0, category: "temporal", subcategory: "none.explicit", note: "Requirements-register marker of optionality; implies no date because the task itself is optional." },
  // NOTE: `whenever`, `whenever works`, `when you can`, `at your convenience` deliberately
  // absent — they belong to downgraders.ts per §0.3. Do not add them here.
];

export const TEMPORAL_VAGUE: LexEntry[] = [
  { pattern: /\bsometime\b/i, weight: 0.5, category: "temporal", subcategory: "vague", note: "Asserts that a time exists without constraining it; establishes an expectation of eventual action and nothing more." },
  { pattern: /\bat some point\b/i, weight: 0.5, category: "temporal", subcategory: "vague", note: "Existential time reference with no bound; the weakest positive deadline signal in the ladder." },
  { pattern: /\beventually\b/i, weight: 0.5, category: "temporal", subcategory: "vague", note: "Asserts eventual completion; implies the task is not forgotten, which is a real if minimal force signal." },
  { pattern: /\bdown the (line|road|track)\b/i, weight: 0.5, category: "temporal", subcategory: "vague", note: "Idiomatic future deferral; positions the task as real but unscheduled." },
  { pattern: /\bin due course\b/i, weight: 0.5, category: "temporal", subcategory: "vague", note: "Formal-register vague deadline; common in UK and legal correspondence." },
  { pattern: /\bbefore (too|much) long\b/i, weight: 0.5, category: "temporal", subcategory: "vague", note: "Negatively bounded but unquantified; asserts a limit without naming it." },
  { pattern: /\bin the (near|nearish) (future|term)\b/i, weight: 0.5, category: "temporal", subcategory: "vague", note: "Corporate-register vague horizon; more committed than *eventually*, less than *this week*." },
  { pattern: /\bat some stage\b/i, weight: 0.5, category: "temporal", subcategory: "vague", note: "Variant existential time reference; distinct string, same function." },
  { pattern: /\bafter the (dust settles|crunch|launch madness)\b/i, weight: 0.5, category: "temporal", subcategory: "vague", note: "Idiomatic post-event deferral with no resolvable event date." },
  { pattern: /\bat some point (this|next) (month|quarter)\b/i, weight: 0.5, category: "temporal", subcategory: "vague", note: "**Uncertain** — has a nominal bound, so it arguably belongs at `relative`; kept vague because month- and quarter-scale bounds exert almost no near-term pressure." },
];

export const TEMPORAL_RELATIVE: LexEntry[] = [
  { pattern: /\bthis week\b/i, weight: 1.5, category: "temporal", subcategory: "relative", note: "Bounds the deadline to a period with a definite end; the hearer can compute remaining time, which is what separates relative from vague." },
  { pattern: /\bnext week\b/i, weight: 1.5, category: "temporal", subcategory: "relative", note: "Bounded but further out; same computability, lower proximity — proximity is handled by the bonus function, not the rung." },
  { pattern: /\bsoon\b/i, weight: 1.5, category: "temporal", subcategory: "relative", note: "Asserts near-term action without a bound; **uncertain** placement — it lacks computability but carries clear urgency, so I ranked it on force rather than precision." },
  { pattern: /\bshortly\b/i, weight: 1.5, category: "temporal", subcategory: "relative", note: "Formal-register near-term marker; functionally identical to *soon*." },
  { pattern: /\bin the next (few|couple of) (days|hours)\b/i, weight: 1.5, category: "temporal", subcategory: "relative", note: "Explicit bounded window with a stated unit; among the most computable relative forms." },
  { pattern: /\bwithin (?:the next )?(\d+|a few|two|three) (days|hours|weeks)\b/i, weight: 1.5, category: "temporal", subcategory: "relative", note: "Quantified duration bound; the numeral makes the constraint checkable. (Prompt 6R-C: the optional `the next` filler now also matches `within the next two hours`, the same bounded-duration concept as `within two hours` — same weight/rung/category, no new number range introduced.)" },
  { pattern: /\bby the end of (the )?(week|sprint|month)\b/i, weight: 1.5, category: "temporal", subcategory: "relative", note: "Period-terminal deadline; resolvable to a date only if the period boundary is known, hence relative rather than named-day." },
  { pattern: /\bthis sprint\b/i, weight: 1.5, category: "temporal", subcategory: "relative", note: "Engineering-register period bound; organizationally definite even though the calendar date is implicit." },
  { pattern: /\bbefore (the )?(standup|retro|sync|review|demo)\b/i, weight: 1.5, category: "temporal", subcategory: "relative", note: "Event-anchored deadline where the event is recurring and scheduled; resolvable in principle, which is why it clears `vague`." },
  { pattern: /\bahead of (the )?(meeting|call|session)\b/i, weight: 1.5, category: "temporal", subcategory: "relative", note: "Event-anchored precedence deadline; the anchor supplies a real constraint." },
  { pattern: /\bin the next day or (two|so)\b/i, weight: 1.5, category: "temporal", subcategory: "relative", note: "Approximate bounded window; the approximation keeps it below named-day precision." },
  { pattern: /\bover the next (day|couple of days)\b/i, weight: 1.5, category: "temporal", subcategory: "relative", note: "Durative window framing; same computability as the above." },
  { pattern: /\bthis (morning|afternoon|evening)\b/i, weight: 1.5, category: "temporal", subcategory: "relative", note: "Same-day period bound; **uncertain** — its proximity makes it feel closer to `immediate`, and the proximity bonus will largely correct for this." },
  { pattern: /\bbefore (the )?weekend\b/i, weight: 1.5, category: "temporal", subcategory: "relative", note: "Week-terminal deadline expressed by boundary event; resolvable relative to the message timestamp." },
  { pattern: /\bearly next week\b/i, weight: 1.5, category: "temporal", subcategory: "relative", note: "Partially specified window; more constrained than *next week*, less than a named day." },
  { pattern: /\bin a (couple|few) of hours\b/i, weight: 1.5, category: "temporal", subcategory: "relative", note: "Sub-day bounded window; ranked by precision rather than proximity, with the bonus doing the urgency work." },
];

export const TEMPORAL_NAMED_DAY: LexEntry[] = [
  { pattern: /\bby (mon|tues|wednes|thurs|fri|satur|sun)day\b/i, weight: 3.0, category: "temporal", subcategory: "named_day", note: "Explicit weekday deadline with a terminal preposition; resolves to a single date, which is a step change in accountability over any window." },
  { pattern: /\bon (mon|tues|wednes|thurs|fri|satur|sun)day\b/i, weight: 3.0, category: "temporal", subcategory: "named_day", note: "Weekday with locative preposition; slightly weaker than *by* since it names an occasion rather than a limit." },
  { pattern: /\b(mon|tues|wednes|thurs|fri)day (at the latest|latest)\b/i, weight: 3.0, category: "temporal", subcategory: "named_day", note: "Weekday with an explicit terminal qualifier; unambiguously a limit rather than a target." },
  { pattern: /\bend of (the )?week\b/i, weight: 3.0, category: "temporal", subcategory: "named_day", note: "Resolves to a specific day given a known work calendar; ranked above `relative` because the resolution is deterministic." },
  { pattern: /\bEOW\b/, weight: 3.0, category: "temporal", subcategory: "named_day", note: "Abbreviated end-of-week; identical semantics, high frequency in chat, and must be whitelisted against the all-caps upgrader." },
  { pattern: /\btomorrow\b/i, weight: 3.0, category: "temporal", subcategory: "named_day", note: "Deictic day reference resolving to a single date from the message timestamp; day-precise, hence this rung." },
  { pattern: /\bday after tomorrow\b/i, weight: 3.0, category: "temporal", subcategory: "named_day", note: "Two-step deictic day reference; equally resolvable, marginally less proximate." },
  { pattern: /\bby the (\d{1,2})(st|nd|rd|th)\b/i, weight: 3.0, category: "temporal", subcategory: "named_day", note: "Ordinal date without a month; resolves against the current month, day-precise." },
  { pattern: /\bon the (\d{1,2})(st|nd|rd|th)\b/i, weight: 3.0, category: "temporal", subcategory: "named_day", note: "Locative ordinal date; names an occasion rather than a limit, same precision." },
  { pattern: /\bmonday morning\b/i, weight: 3.0, category: "temporal", subcategory: "named_day", note: "Day plus period; **uncertain** — it carries partial time-of-day information and could arguably sit at `date_time`, but a period is not a clock time." },
  // Weekday-qualified EOD/COB is handled in the date_time parser rule below; do not also score it here.
  { pattern: /\bbefore (mon|tues|wednes|thurs|fri)day\b/i, weight: 3.0, category: "temporal", subcategory: "named_day", note: "Precedence deadline against a named day; strictly a limit, so it is at the top of this rung's force range." },
  { pattern: /\bby (next|this) (mon|tues|wednes|thurs|fri)day\b/i, weight: 3.0, category: "temporal", subcategory: "named_day", note: "Disambiguated weekday deadline; the determiner removes the week-ambiguity that bare weekday names carry." },
  { pattern: /\b(this|next) (monday|tuesday|wednesday|thursday|friday)\b/i, weight: 3.0, category: "temporal", subcategory: "named_day", note: "Determiner-qualified weekday without a preposition; day-precise, occasion-framed." },
  { pattern: /\bend of (the )?(month|quarter)\b/i, weight: 3.0, category: "temporal", subcategory: "named_day", note: "Period-terminal date that resolves deterministically; the long horizon is handled by the proximity bonus, not the rung." },
  { pattern: /\bdeadline is (mon|tues|wednes|thurs|fri)day\b/i, weight: 3.0, category: "temporal", subcategory: "named_day", note: "Explicit deadline nominal plus named day; the metalinguistic label makes the constraint maximally unambiguous." },
];

export const TEMPORAL_DATE_TIME: LexEntry[] = [
  { pattern: /\b(?:mon|tues|wednes|thurs|fri|satur|sun)day (?:EOD|COB)\b/i, weight: 4.0, category: "temporal", subcategory: "date_time", note: "Weekday-qualified business close resolves to a specific day boundary; unlike bare EOD/COB it must not be treated as same-day immediate." },
  { pattern: /\b(mon|tues|wednes|thurs|fri|satur|sun)day at \d{1,2}(:\d{2})?\s?(am|pm)?\b/i, weight: 4.0, category: "temporal", subcategory: "date_time", note: "Weekday plus clock time; a checkable instant, which is the highest form of deadline specificity short of immediacy." },
  { pattern: /\bby \d{1,2}(:\d{2})?\s?(am|pm)\b/i, weight: 4.0, category: "temporal", subcategory: "date_time", note: "Terminal preposition plus clock time; unambiguous limit at instant precision." },
  { pattern: /\bat \d{1,2}(:\d{2})?\s?(am|pm)\b/i, weight: 4.0, category: "temporal", subcategory: "date_time", note: "Clock time with locative preposition; names an instant, framed as occasion rather than limit. (Prompt 6R-C authoring correction: the minutes group is now optional and the meridiem mandatory, matching the sibling `by \\d{1,2}(:\\d{2})?\\s?(am|pm)` entry above — the previous `(:\\d{2})\\s?(am|pm)?` required a colon and made the meridiem optional, so a colon-less clock time like `at 2pm` could never match at all.)" },
  { pattern: /\bby the \d{1,2}(st|nd|rd|th) of \w+\b/i, weight: 4.0, category: "temporal", subcategory: "date_time", note: "Full date with month; instant-precise at day granularity with no calendar ambiguity." },
  { pattern: /\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/, weight: 4.0, category: "temporal", subcategory: "date_time", note: "Numeric date; must be locale-disambiguated at parse time, and the analysis MUST record which convention was assumed." },
  { pattern: /\b\d{4}-\d{2}-\d{2}\b/, weight: 4.0, category: "temporal", subcategory: "date_time", note: "ISO date; unambiguous by construction and the preferred internal representation." },
  { pattern: /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* \d{1,2}\b/i, weight: 4.0, category: "temporal", subcategory: "date_time", note: "Month-name plus day; standard in email and unambiguous across locales." },
  { pattern: /\bbefore \d{1,2}\s?(am|pm)\b/i, weight: 4.0, category: "temporal", subcategory: "date_time", note: "Precedence deadline at clock precision; strictly a limit." },
  { pattern: /\bno later than \d{1,2}(:\d{2})?\s?(am|pm)?\b/i, weight: 4.0, category: "temporal", subcategory: "date_time", note: "Explicit maximality operator plus clock time; leaves no interpretive latitude at all." },
  { pattern: /\bdue (on|by) \w+ \d{1,2}\b/i, weight: 4.0, category: "temporal", subcategory: "date_time", note: "Deadline nominal plus date; the *due* label makes the constraint metalinguistically explicit." },
  { pattern: /\b\d{1,2}(:\d{2})?\s?(am|pm) (on )?(mon|tues|wednes|thurs|fri)day\b/i, weight: 4.0, category: "temporal", subcategory: "date_time", note: "Time-first ordering of clock plus weekday; same precision, distinct surface form." },
  { pattern: /\bstart of (play|business) (mon|tues|wednes|thurs|fri)day\b/i, weight: 4.0, category: "temporal", subcategory: "date_time", note: "Business-convention instant plus named day; resolves to a specific hour under standard office norms." },
  { pattern: /\bby (\d{1,2})(st|nd|rd|th) close\b/i, weight: 4.0, category: "temporal", subcategory: "date_time", note: "Ordinal date plus business-close convention; instant-precise under a known calendar." },
  { pattern: /\b(before|by) the \d{1,2}(am|pm) (cutoff|cut[- ]off)\b/i, weight: 4.0, category: "temporal", subcategory: "date_time", note: "Names an institutional cutoff at clock precision; the cutoff framing implies a hard consequence for missing it." },
  { pattern: /\b\d{1,2}(:\d{2})?\s?(am|pm) (sharp|latest)\b/i, weight: 4.0, category: "temporal", subcategory: "date_time", note: "Clock time with an emphatic precision qualifier; the qualifier forecloses the usual tolerance around stated times." },
  { pattern: /\bcalendar invite for \w+ \d{1,2}\b/i, weight: 4.0, category: "temporal", subcategory: "date_time", note: "Deadline instantiated as a scheduled artifact; the invite makes the constraint externally visible, which raises force further." },
];

export const TEMPORAL_IMMEDIATE: LexEntry[] = [
  { pattern: /\b(?:within|in) (?:[1-9]|[1-5]\d) minutes?\b/i, weight: 5.0, category: "temporal", subcategory: "immediate", note: "Explicit sub-hour bound from 1–59 minutes; this covers natural forms such as `within 20 minutes` without hard-coding one duration. (Prompt 6R-C: extended to also accept the equivalent `in 20 minutes` surface form of the same bounded-duration concept — same weight/rung/category, no new lexical entry.)" },
  { pattern: /\bASAP\b/i, weight: 5.0, category: "temporal", subcategory: "immediate", note: "Maximal urgency with no upper bound on priority; assigned here rather than to upgraders per §0.3." },
  { pattern: /\bby noon\b/i, weight: 5.0, category: "temporal", subcategory: "immediate", note: "Same-day mid-day limit; sub-day precision plus same-day scope puts it on the top rung." },
  { pattern: /\bnow\b/i, weight: 5.0, category: "temporal", subcategory: "immediate", note: "Zero-latency demand; leaves no interval in which the hearer can schedule the task." },
  { pattern: /\bright (now|away)\b/i, weight: 5.0, category: "temporal", subcategory: "immediate", note: "Intensified immediacy; explicitly forecloses even brief deferral." },
  { pattern: /\bimmediately\b/i, weight: 5.0, category: "temporal", subcategory: "immediate", note: "Formal-register zero-latency adverb; standard in incident and security communication." },
  { pattern: /\bfirst thing (tomorrow|monday|in the morning)\b/i, weight: 5.0, category: "temporal", subcategory: "immediate", note: "Next-available-slot deadline; functionally immediate because it claims the hearer's first uncommitted time." },
  { pattern: /\bin the next (hour|30 minutes|half hour)\b/i, weight: 5.0, category: "temporal", subcategory: "immediate", note: "Sub-hour window; short enough that it preempts whatever the hearer is currently doing." },
  { pattern: /\bbefore you (log off|finish|clock out|head out)\b/i, weight: 5.0, category: "temporal", subcategory: "immediate", note: "Same-day deadline anchored to the hearer's own schedule; unusually binding because the anchor is under their control." },
  { pattern: /\bwithin the hour\b/i, weight: 5.0, category: "temporal", subcategory: "immediate", note: "Formal sub-hour bound; identical to the colloquial variant at higher register." },
  { pattern: /\bneeded (yesterday|an hour ago)\b/i, weight: 5.0, category: "temporal", subcategory: "already_past", note: "Past-due framing; resolve the stated past point and let the overdue branch of `proximityBonus` apply." },
  { pattern: /\b(was|were) due (yesterday|(?:mon|tues|wednes|thurs|fri|satur|sun)day)\b/i, weight: 5.0, category: "temporal", subcategory: "already_past", note: "Explicit missed deadline. Resolve to the most recent matching past date, never a future occurrence." },
  { pattern: /\bdue yesterday\b/i, weight: 5.0, category: "temporal", subcategory: "already_past", note: "Compact overdue form; same semantics as `was due yesterday`." },
  { pattern: /\balready overdue\b/i, weight: 5.0, category: "temporal", subcategory: "already_past", note: "Explicitly states that the deadline has passed even if the original date is not recoverable; maximum rung, unresolved timestamp allowed." },
  { pattern: /\boverdue since\s+((?:mon|tues|wednes|thurs|fri|satur|sun)day|\w+\s+\d{1,2})\b/i, weight: 5.0, category: "temporal", subcategory: "already_past", note: "Names the start of the overdue interval; resolve to the stated past date." },
  { pattern: /\bwas supposed to be (in|done|sent|submitted) (yesterday|(?:mon|tues|wednes|thurs|fri|satur|sun)day)\b/i, weight: 5.0, category: "temporal", subcategory: "already_past", note: "Conventional missed-deadline construction; the obligation wording is not the force evidence—the matched evidence event is the past time anchor." },
];

/** Every temporal rung array, ordered most-direct... i.e. highest rung first, for use by force/temporal.ts's highest-rung-wins scan (LEXICON.md §4: "Matching returns the highest rung that fires, not the first"). */
export const TEMPORAL_RUNG_ORDER: readonly TemporalRung[] = ["immediate", "date_time", "named_day", "relative", "vague", "none"];

export const TEMPORAL_ENTRIES_BY_RUNG: Record<TemporalRung, LexEntry[]> = {
  immediate: TEMPORAL_IMMEDIATE,
  date_time: TEMPORAL_DATE_TIME,
  named_day: TEMPORAL_NAMED_DAY,
  relative: TEMPORAL_RELATIVE,
  vague: TEMPORAL_VAGUE,
  none: TEMPORAL_NONE,
};
