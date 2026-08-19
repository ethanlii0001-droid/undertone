/**
 * Computes surface strength: how forcefully the identified request is
 * phrased, per SPEC.md §7. surface = clamp(baseStrategy + modifierDelta, 0,
 * 10), where baseStrategy comes from the CCSARP directness scale
 * (LEXICON.md §1) and modifierDelta is the clamped ([-3.0, +3.0]) sum of
 * downgrader/upgrader contributions (LEXICON.md §2, §3).
 *
 * Independence boundary (CLAUDE.md rule 3): this module must import only
 * from lexicons/directness.ts, lexicons/downgraders.ts, and
 * lexicons/upgraders.ts. It must never import from force/*.ts or from any
 * force-side lexicon file.
 */
