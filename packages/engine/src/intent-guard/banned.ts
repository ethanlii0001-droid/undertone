/**
 * Canonical list of banned intent-claiming phrases and constructions (e.g.
 * sender "meant", "intended", "really wanted", "knew", "believed", "trying
 * to") that must never appear in UnderTone user-facing copy, per SPEC.md
 * §13.1 and CLAUDE.md rule 5. Permitted subjects for analysis statements
 * are the message, the request, the wording, the phrasing, the surrounding
 * language, and a reader — never the sender's mind. Also enforces SPEC.md
 * §13.1's reader-effect modalization requirement (`findReaderEffectViolation`
 * below): a reader-effect statement is only safe when modalized (`is likely
 * to`, `tends to`, `at risk of`).
 *
 * Scope (Prompt 7B): this list guards GENERATED user-facing analysis text
 * (e.g. the SPEC.md §13.1 gap-report template), never raw input `Message`
 * text. A sender writing "I intended to send this yesterday" in their own
 * message is not something this guard evaluates or rejects — only text
 * UnderTone itself produces about a message is in scope.
 */

export interface BannedIntentPattern {
  readonly pattern: RegExp;
  readonly description: string;
}

/**
 * Splits `text` at the strong sentence/clause boundaries a person-subject
 * and a mental-state verb (or "reader" and an effect claim) must not cross
 * to still count as one collocated construction (Prompt 7 Final Cleanup
 * Task 1/3): `.`, `?`, `!`, `;`. Ordinary clause material — commas,
 * parentheticals like ", based on the surrounding context,", adverbs — does
 * NOT split a clause; only these four characters do.
 */
function splitIntoClauses(text: string): string[] {
  return text.split(/[.?!;]/);
}

/**
 * Person-referring subjects a mental-state verb must attach to for this to
 * count as a sender-intent claim (SPEC.md §13.1's banned-subject side) —
 * never "reader", "message", "wording", etc., which are the permitted
 * analysis subjects.
 */
const INTENT_SUBJECT = "(?:the sender|sender|they|he|she)";

/**
 * Mental-state verbs/constructions SPEC.md §13.1 explicitly bans
 * attributing to a sender. `trying to` alone (rather than enumerating
 * "is/was/were trying to") deliberately covers every tense — "is trying
 * to", "was trying to", "were trying to", and a bare "trying to" — since
 * the tense auxiliary is ordinary intervening clause material the
 * same-clause rule below already tolerates; requiring it explicitly would
 * only miss a phrasing that varies the auxiliary further ("must have been
 * trying to").
 */
const INTENT_VERB = "(?:meant|mean|intended|intends?|knew|know|believed|believes?|trying to|really wanted|truly wanted|wanted you to)";

/**
 * One banned construction per entry, each requiring `INTENT_SUBJECT` and
 * `INTENT_VERB` to co-occur within a single clause. The gap between them
 * (`[^.?!;]*`) is unbounded — arbitrary ordinary clause material such as
 * ", based on the surrounding context," may separate subject from verb —
 * but may never cross a strong clause boundary (`.`/`?`/`!`/`;`), which the
 * excluded character class enforces directly without needing a fixed
 * character cap (Prompt 7 Final Cleanup Task 1: the previous 25-character
 * cap let "The sender, based on the surrounding context, intended this as
 * an order." escape undetected).
 */
export const BANNED_INTENT_PATTERNS: readonly BannedIntentPattern[] = [
  {
    pattern: new RegExp(`\\b${INTENT_SUBJECT}\\b[^.?!;]*\\b${INTENT_VERB}\\b`, "i"),
    description: 'A person-referring subject ("the sender"/"they"/"he"/"she") is paired, within the same clause, with a mental-state verb (meant/intended/knew/believed/trying to/really wanted/wanted you to) — an intent/knowledge/desire claim SPEC.md §13.1 forbids.',
  },
  {
    pattern: /\bintended (?:this|it) as\b/i,
    description: '"intended this/it as" — a direct claim about sender intent, independent of an explicit subject word.',
  },
  {
    pattern: /\bmeant (?:this|it) as\b/i,
    description: '"meant this/it as" — a direct claim about what the sender meant, independent of an explicit subject word.',
  },
];

// ---------------------------------------------------------------------------
// Reader-effect modalization (SPEC.md §13.1, Prompt 7 Final Cleanup Task 3)
// ---------------------------------------------------------------------------

/**
 * SPEC.md §13.1's permitted reader-effect modal markers: `is/are likely
 * to`, `tends/tend to`, `at risk of`. A clause mentioning "reader" is safe
 * whenever one of these appears in it, regardless of what else the clause
 * says.
 */
const READER_MODAL_RE = /\b(?:is|are)\s+likely\s+to\b|\btends?\s+to\b|\bat\s+risk\s+of\b/i;

/**
 * A finite verb directly following "reader(s)" (optionally through a short
 * article/determiner) that is NOT one of the modal/auxiliary openers —
 * e.g. "reader under-weights", "reader reads" — signals an unmodalized
 * present-tense claim about reader effect (SPEC.md §13.1). Deliberately
 * checks only the word immediately following "reader" (not an arbitrary
 * later word in the clause), so an ordinary, unrelated mention of "reader"
 * elsewhere in a sentence — "See the reader guide for details." — is never
 * flagged (Task 3: "do not reject ordinary non-effect statements involving
 * the word 'reader'").
 */
const READER_BARE_VERB_RE =
  /\breaders?\b\s+(?:a\s+|the\s+|this\s+)?(?!is\b|are\b|was\b|were\b|does\b|has\b|likely\b|tends?\b|tend\b)([a-z][a-z-]*s)\b/i;

/**
 * "reader ... will" / "reader ... definitely" within one clause: an
 * unmodalized future claim or an unmodalized intensified claim, neither of
 * which SPEC.md §13.1's permitted modal set (`likely to`/`tends to`/`at
 * risk of`) covers.
 */
const READER_WILL_OR_DEFINITELY_RE = /\breaders?\b[^.?!;]*\b(?:will|definitely)\b/i;

const READER_WORD_RE = /\breaders?\b/i;

/**
 * Finds a non-modalized reader-effect claim (SPEC.md §13.1) in `text`,
 * clause by clause (same strong-boundary rule as `splitIntoClauses`
 * above). A clause is only evaluated when it mentions "reader" at all; it
 * is safe if a permitted modal marker also appears in it; otherwise it is
 * a violation only when it also contains one of the two narrow unmodalized
 * claim shapes above (a bare verb directly after "reader", or "will"/
 * "definitely" anywhere in the clause) — never merely for containing the
 * word "reader".
 */
export function findReaderEffectViolation(text: string): BannedIntentPattern | null {
  for (const clause of splitIntoClauses(text)) {
    if (!READER_WORD_RE.test(clause)) continue;
    if (READER_MODAL_RE.test(clause)) continue;
    if (READER_BARE_VERB_RE.test(clause)) {
      return {
        pattern: READER_BARE_VERB_RE,
        description: '"reader" is followed directly by an unmodalized finite verb (e.g. "reader under-weights...") — SPEC.md §13.1 requires reader-effect statements to be modalized ("is likely to"/"tends to"/"at risk of").',
      };
    }
    if (READER_WILL_OR_DEFINITELY_RE.test(clause)) {
      return {
        pattern: READER_WILL_OR_DEFINITELY_RE,
        description: '"reader" is paired with an unmodalized "will"/"definitely" claim — SPEC.md §13.1 requires reader-effect statements to be modalized ("is likely to"/"tends to"/"at risk of").',
      };
    }
  }
  return null;
}
