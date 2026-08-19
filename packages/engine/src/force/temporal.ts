/**
 * Deadline specificity and proximity reasoning for the force scorer, per
 * SPEC.md §9. Implements the temporal ladder (LEXICON.md §4), dynamic
 * today/EOD/COB resolution against Message.timestamp and an explicit
 * business-day config (SPEC.md §9.1), past-due handling (SPEC.md §9.2), and
 * the deterministic proximityBonus curve (SPEC.md §9.3:
 * MAX * exp(-hoursRemaining / 48), capped at MAX = 1.5).
 *
 * Reads only timestamps supplied in the input — never the wall clock
 * (CLAUDE.md rule 1).
 */
