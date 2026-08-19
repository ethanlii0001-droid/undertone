/**
 * Normalizes message text while preserving original character offsets, per
 * SPEC.md §5 step 1 (Pipeline). Purely mechanical text normalization
 * (whitespace/unicode handling) — no linguistic scoring happens here. Every
 * downstream Span must remain valid against the original, un-normalized
 * source text.
 */
