/**
 * The 10 negative controls from EVAL.md's "## Negative controls" section,
 * loaded verbatim by scripts/extract-eval-fixtures.mjs. Not part of the 120
 * core-pair count (EVAL.md line 2170). Shape matches EVAL.md's own JSON
 * exactly: {id, message, expected, note} — `expected` is a free-text
 * qualitative description, not a comparable formula, so no assertion logic
 * is invented against it here beyond what independence.test.ts already
 * encodes (force === 3.0 baseline or suppressed).
 */
import rawNegativeControls from "./negative-controls.json";

export interface NegativeControl {
  id: string;
  message: string;
  expected: string;
  note: string;
}

export const negativeControls = rawNegativeControls as NegativeControl[];
