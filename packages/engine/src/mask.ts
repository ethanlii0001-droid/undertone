/**
 * Builds the offset-preserving MaskedMessage consumed by the force scorer,
 * per SPEC.md §10 (Masking and partition invariant). Masks modal verbs and
 * grammatical mood markers belonging to the head act, every span already
 * consumed as surface downgrader/upgrader evidence where needed to prevent
 * force reuse, and quoted/reporting material suppressed by request
 * detection.
 *
 * This is the mechanism that enforces the surface/force independence claim
 * (SPEC.md §5.1; CLAUDE.md rule 3): force scoring must never see raw
 * surface material, only the masked view this module produces.
 */
