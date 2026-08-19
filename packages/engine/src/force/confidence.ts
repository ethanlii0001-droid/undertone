/**
 * Computes Confidence: how reliable this particular rule-based analysis is
 * — not how certain the sender was, and not how likely the recipient is to
 * comply — per SPEC.md §12. Depends primarily on head-act detection
 * certainty, surface/force partition clarity, independent event count
 * after deduplication (not raw regex match count), lexical ambiguity, and
 * hard-case flags. Many overlapping matches must not raise confidence.
 * Maximum displayed confidence is 0.95.
 */
