/**
 * Internal-modification patterns that intensify a request's phrasing —
 * intensifiers and evaluative adjectives such as "critical", "urgent",
 * "high priority" — per LEXICON.md §3. Feeds the surface scorer only; these
 * intensify the phrasing itself rather than describe independently
 * observable force evidence (LEXICON.md §0.3 collision table).
 *
 * Transcribed verbatim from LEXICON.md §3 — pattern, weight, category,
 * subcategory, and note are copied as specified. Do not tune weights or
 * patterns here; fix LEXICON.md instead if an entry is wrong.
 *
 * The `emphatic_orthography` all-caps entry's own note requires excluding
 * a whitelist of acronyms (EOD, COB, PR, QA, API) "or it will fire
 * constantly" — that whitelist is a matching-time rule the regex itself
 * cannot express, so surface/score.ts applies it when consuming this
 * entry.
 *
 * Separately (Prompt 5 reconciliation), the generic `[A-Z]{3,}` pattern is
 * purely orthographic — it matches ANY all-caps 3+ letter token, with no
 * awareness that some of those tokens are words LEXICON.md §0.3 has
 * already ruled OUT of the surface upgrader lexicon entirely (`ASAP`,
 * `now`, `immediately`, `blocking`, `blocker`, `blocked` — temporal/
 * dependency force-only). Lowercase forms of those words already don't
 * match any surface pattern, since no entry in this file mentions them;
 * the leak is specifically that writing one of them in caps (`ASAP`,
 * `BLOCKED`) makes it collide with the unrelated, orthography-only
 * emphatic-caps rule. `EMPHATIC_ORTHOGRAPHY_EXCLUDED_TOKENS` below
 * excludes both reasons (acronym-noise and §0.3 collision) from the same
 * matching-time check, since both are "this specific all-caps token must
 * not count," just for different reasons — see each token's comment.
 */
import type { LexEntry } from "../types.js";

/**
 * Surface-side normalization constant applied to every upgrader's raw
 * weight (LEXICON.md §0.1 `SCALE.upgrader`). Raw weights are unsigned
 * salience magnitudes; this constant supplies both the sign and the scale
 * of an upgrader's contribution.
 */
export const UPGRADER_SCALE = 0.4;

export const UPGRADERS: LexEntry[] = [

  // ── Intensifiers ──────────────────────────────────────────────────────────
  { pattern: /\breally\b/i, weight: 1.0, category: "upgrader", subcategory: "intensifier", note: "Scalar intensifier over the predicate; raises the speaker's degree of commitment without changing the strategy level." },
  { pattern: /\bvery\b/i, weight: 0.8, category: "upgrader", subcategory: "intensifier", note: "Neutral degree intensifier; weaker than *really* in chat register because it reads as formal rather than emphatic." },
  { pattern: /\babsolutely\b/i, weight: 1.6, category: "upgrader", subcategory: "intensifier", note: "Maximizer admitting no degree; forecloses negotiation over the extent of compliance." },
  { pattern: /\bcompletely\b/i, weight: 1.2, category: "upgrader", subcategory: "intensifier", note: "Totality maximizer over the requested action; raises the completion standard." },
  { pattern: /\breally really\b/i, weight: 1.8, category: "upgrader", subcategory: "intensifier", note: "Reduplicated intensifier; the repetition itself signals that the unreduplicated form was expected to be insufficient." },
  { pattern: /\bso (much|badly)\b/i, weight: 1.0, category: "upgrader", subcategory: "intensifier", note: "Degree intensifier with affective loading; common in chat requests for help." },
  { pattern: /\bat all costs\b/i, weight: 2.2, category: "upgrader", subcategory: "intensifier", note: "Explicitly ranks the request above competing constraints; near the top of the intensifier scale." },
  { pattern: /\bwhatever it takes\b/i, weight: 2.0, category: "upgrader", subcategory: "intensifier", note: "Removes cost limits on compliance; intensifies by refusing to bound the imposition." },

  // ── Commitment indicators ─────────────────────────────────────────────────
  { pattern: /\bobviously\b/i, weight: 1.4, category: "upgrader", subcategory: "commitment", note: "Presents the requested action as self-evidently required, making disagreement socially costly." },
  { pattern: /\bclearly\b/i, weight: 1.2, category: "upgrader", subcategory: "commitment", note: "Evidential maximizer; asserts that the necessity of the request is not in dispute." },
  { pattern: /\bdefinitely\b/i, weight: 1.2, category: "upgrader", subcategory: "commitment", note: "Modal certainty marker; removes the hedging space a bare assertion would leave." },
  { pattern: /\bwithout (question|a doubt)\b/i, weight: 1.4, category: "upgrader", subcategory: "commitment", note: "Formulaic certainty maximizer; forecloses the hearer's grounds for challenge." },
  { pattern: /\bthere'?s no (way|question|option)\b/i, weight: 1.8, category: "upgrader", subcategory: "commitment", note: "Negated-possibility frame; asserts that no alternative to compliance exists." },
  { pattern: /\bneeds? to happen\b/i, weight: 1.6, category: "upgrader", subcategory: "commitment", note: "Agentless necessity assertion appended to a request; commits the speaker to the action's inevitability." },
  { pattern: /\bnon[- ]negotiable\b/i, weight: 2.4, category: "upgrader", subcategory: "commitment", note: "Explicitly cancels the negotiability that indirect phrasing would otherwise imply; near the ceiling of the scale." },

  // ── Lexical uptoners ──────────────────────────────────────────────────────
  { pattern: /\bcritical\b/i, weight: 2.0, category: "upgrader", subcategory: "lexical_uptoner", note: "Maximal evaluative adjective for task importance; assigned to surface per §0.3, though the force reading is arguable." },
  { pattern: /\burgent(ly)?\b/i, weight: 2.0, category: "upgrader", subcategory: "lexical_uptoner", note: "Explicit priority adjective; note it is *not* a deadline, since it names no resolvable time — that separation is what keeps §4 disjoint from §3." },
  { pattern: /\b(top|high|highest) priority\b/i, weight: 1.8, category: "upgrader", subcategory: "lexical_uptoner", note: "Explicit ranking against the hearer's other work; the mirror image of the *low priority* downgrader." },
  { pattern: /\bessential\b/i, weight: 1.6, category: "upgrader", subcategory: "lexical_uptoner", note: "Necessity adjective; asserts the action is a precondition rather than a preference." },
  { pattern: /\b(huge|massive|enormous)\b/i, weight: 1.2, category: "upgrader", subcategory: "lexical_uptoner", note: "Magnitude adjective applied to stakes or impact; colloquial register intensification." },
  { pattern: /\bserious(ly)?\b/i, weight: 1.4, category: "upgrader", subcategory: "lexical_uptoner", note: "Gravity marker; raises the perceived consequence class of the request." },
  { pattern: /\bbig deal\b/i, weight: 1.4, category: "upgrader", subcategory: "lexical_uptoner", note: "Colloquial stakes marker; the affirmative counterpart of the *not a big deal* downgrader." },
  { pattern: /\breally important\b/i, weight: 1.6, category: "upgrader", subcategory: "lexical_uptoner", note: "Intensified importance adjective; explicit and unhedged assertion of priority." },
  { pattern: /\bmust[- ]have\b/i, weight: 1.8, category: "upgrader", subcategory: "lexical_uptoner", note: "Requirements-register nominal; classifies the request as mandatory rather than desirable." },

  // ── Emphatic orthography and repetition ───────────────────────────────────
  { pattern: /\b[A-Z]{3,}\b/, weight: 1.2, category: "upgrader", subcategory: "emphatic_orthography", note: "All-caps content word is a prosodic shout in text; must exclude a whitelist of acronyms (EOD, COB, PR, QA, API) or it will fire constantly." },
  // A single `!` is deliberately NOT scored in v1.1: in workplace chat it is too ambiguous between warmth, enthusiasm, and force.
  { pattern: /!{2,}/, weight: 1.6, category: "upgrader", subcategory: "emphatic_orthography", note: "Repeated exclamation marks; unlike a single mark, repetition reliably signals urgency or frustration rather than friendliness." },
  { pattern: /\b(\w+)\s+\1\b/i, weight: 0.8, category: "upgrader", subcategory: "repetition", note: "Immediate lexical reduplication ('now now', 'today today'); marks insistence through redundancy." },
];

/**
 * Tokens exempted from the all-caps `emphatic_orthography` pattern.
 * Matched case-insensitively against the full matched token by the
 * consuming scorer, since the lexicon pattern itself has no way to encode
 * an exclusion list inside a single regex. Two independent reasons feed
 * this one set:
 *
 * - Acronym noise (LEXICON.md §3's own note on the entry): common
 *   workplace acronyms would otherwise fire constantly and swamp genuine
 *   emphatic-caps evidence — EOD, COB, PR, QA, API.
 * - LEXICON.md §0.3 collision ruling: ASAP/now/immediately/right away/
 *   first thing are ruled temporal-only (force), and blocking/blocker/
 *   blocked/holding up are ruled dependency-only (force) — "surface
 *   upgraders only in v1.1" does NOT apply to them, in any capitalization.
 *   Without this exclusion, writing one of these words in caps ("Could you
 *   send this ASAP?") would let the orthography-only all-caps rule smuggle
 *   back in exactly the surface contribution §0.3 rules out — a collision
 *   between an unrelated orthographic pattern and an already-settled
 *   lexical ruling, not a change to the ruling itself. `holding up`
 *   contributes only via `HOLDING` ("up" is too short to match
 *   `[A-Z]{3,}`), which is excluded below as a single token. `right away`
 *   and `first thing` are different: EACH word is individually 3+ letters
 *   ("RIGHT AWAY" collides via "RIGHT", "FIRST THING" via "FIRST"), so a
 *   single-token set cannot exclude them without also blacklisting
 *   "RIGHT"/"FIRST" everywhere — including genuine unrelated emphatic use.
 *   `EMPHATIC_ORTHOGRAPHY_EXCLUDED_PHRASES` below handles those two
 *   phrase-level, by checking whether a candidate all-caps match's span
 *   overlaps an occurrence of the phrase in the surrounding clause text,
 *   rather than blacklisting either word on its own.
 */
export const EMPHATIC_ORTHOGRAPHY_EXCLUDED_TOKENS: ReadonlySet<string> = new Set([
  // Acronym noise (LEXICON.md §3 note on the emphatic_orthography entry).
  "EOD",
  "COB",
  "PR",
  "QA",
  "API",
  // LEXICON.md §0.3: temporal-only, not a surface upgrader in any capitalization.
  "ASAP",
  "NOW",
  "IMMEDIATELY",
  // LEXICON.md §0.3: dependency-only, not a surface upgrader in any capitalization.
  "BLOCKING",
  "BLOCKER",
  "BLOCKED",
  "HOLDING",
]);

/**
 * Multi-word LEXICON.md §0.3 force-only phrases whose all-caps rendering
 * can trigger the generic `[A-Z]{3,}` pattern one word at a time — "RIGHT
 * AWAY" collides via "RIGHT", "FIRST THING" via "FIRST" — even though
 * neither word alone belongs in `EMPHATIC_ORTHOGRAPHY_EXCLUDED_TOKENS`
 * (blacklisting `RIGHT`/`FIRST` as bare tokens would also wrongly suppress
 * genuine emphatic use of those words outside this construction, e.g. "Get
 * this RIGHT."). The consuming scorer checks whether a candidate all-caps
 * match's span overlaps an occurrence of one of these phrases (matched
 * case-insensitively, so a half-capitalized "RIGHT away" is still caught)
 * in the surrounding clause text, and if so treats it the same as an
 * excluded token.
 */
export const EMPHATIC_ORTHOGRAPHY_EXCLUDED_PHRASES: readonly RegExp[] = [/\bright\s+away\b/i, /\bfirst\s+thing\b/i];
