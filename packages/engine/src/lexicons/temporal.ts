/**
 * Deadline specificity ladder — none / vague / relative / named_day /
 * date_time / immediate — with raw weights, dynamic today/EOD/COB
 * resolution rules, and the proximityBonus formula, per LEXICON.md §4.
 * Feeds the force scorer only.
 *
 * No pattern here may ever be evaluated against unmasked text (LEXICON.md
 * §0.4 rule 5; SPEC.md §10).
 */
