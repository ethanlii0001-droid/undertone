/**
 * Deduplicates force evidence into independent pragmatic events, per
 * SPEC.md §11. Implements the same-span rule (§11.1: substantially
 * overlapping matches describing one event — only the most specific
 * contributes), the same-event rule (§11.2: matches sharing one eventId
 * contribute their strongest applicable value, not a sum), and the
 * same-request matching used to detect repeated requests (§11.4:
 * requestSignature Jaccard similarity >= 0.30, gated by intervening
 * completion signals such as "done"/"sent"/"shipped"/"merged"/"attached").
 */
