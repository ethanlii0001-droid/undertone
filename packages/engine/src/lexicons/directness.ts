/**
 * CCSARP nine-level directness scale (Blum-Kulka et al.), mapped onto an
 * operational 0–10 base surface-strategy score, per LEXICON.md §1. Feeds
 * the surface scorer only. Matching is first-hit, most-direct-first
 * against pre-sorted patterns (LEXICON.md §0.4 rule 1); ties go to the
 * earliest span (SPEC.md §6). The ordering must remain strictly monotonic
 * from L1 to L9 when modifiers are held constant (SPEC.md §7.1).
 */
