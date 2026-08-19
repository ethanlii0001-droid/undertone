/**
 * Computes the repetition/escalation contribution to force, per SPEC.md
 * §11.3. Combines the strongest normalized lexical follow-up marker (max
 * +1.6), verified thread restatement counts (+1.0 / +1.8 / +2.5 for
 * 2nd / 3rd / 4th+ mention), and accelerating-interval / unanswered bonuses
 * (+0.5 each), deduplicated and capped at a combined maximum of 3.0.
 *
 * Reads only the normalized, lemmatized requestSignature (SPEC.md §11.4) —
 * never surface strategy, modal, mood, or modifier information.
 */
