/**
 * Computes communicative force: how strongly evidence independent of
 * surface realization makes action expected, per SPEC.md §8. force =
 * clamp(3.0 + temporalContribution + consequenceContribution +
 * dependencyAccountabilityContribution + repetitionEscalationContribution,
 * 0, 10). The baseline 3.0 represents the expectation of action that exists
 * once a request has been reproducibly identified, independent of any
 * additional pressure evidence (SPEC.md §8).
 *
 * Independence boundary (CLAUDE.md rule 3): this module operates only on
 * the MaskedMessage produced by mask.ts (SPEC.md §10) plus masked prior
 * thread context — never on the raw Message, HeadAct, surface strategy,
 * surface score, modal verb, grammatical mood marker, or any surface-
 * mitigation span. It must import only from lexicons/temporal.ts,
 * lexicons/consequence.ts, and lexicons/dependency.ts.
 */
