/**
 * Identifies whether a message contains a reproducible request and locates
 * its head act — the minimal clause that realizes the request (see
 * CLAUDE.md glossary: "Head act"). Matches clauses against the CCSARP
 * strategy inventory in LEXICON.md §1, using the most-direct-first,
 * earliest-span-wins tie-break rule (LEXICON.md §0.4 rule 1; SPEC.md §6).
 *
 * Implements the request-detection suppression guards of SPEC.md §6.1 (no
 * reproducible request pattern, information-seeking questions, quoted/
 * reported text, unlinkable verbless fragments, unresolved group
 * addressees) and the hint gates of SPEC.md §6.2.
 *
 * Request identification is shared preprocessing and is explicitly NOT
 * claimed to be independent of surface form (SPEC.md §5.1) — that
 * independence claim begins only once a request has been identified.
 */
