/**
 * Segments normalized message text into sentences and clauses, per SPEC.md
 * §5 step 2 (Pipeline). Provides the clause boundaries that headAct.ts
 * matches CCSARP strategies against, and the sentence boundaries that force
 * patterns must never cross (LEXICON.md §0.4 rule 2: "No pattern may match
 * across a sentence boundary").
 */
