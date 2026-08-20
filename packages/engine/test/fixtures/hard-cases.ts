/**
 * The 10 hard cases from EVAL.md's "## Hard cases and scope guards"
 * section, loaded verbatim by scripts/extract-eval-fixtures.mjs. Not part
 * of the 120 core-pair count (EVAL.md line 2241). Shape matches EVAL.md's
 * own JSON exactly: {id, message, challenge, v1_1_behavior, expected,
 * note}.
 *
 * `expected` is heterogeneous free text (some describe a suppression
 * reason like "suppressed:no_head_act", others a qualitative score
 * relationship) — deliberately not turned into per-case pass/fail
 * assertions here, since doing so would require interpreting/inventing
 * comparison logic EVAL.md doesn't itself specify. These are materialized
 * as typed, loadable fixtures only; a dedicated hard-cases test can be
 * written once the specific per-case behavior each one checks
 * (v1_1_behavior) has a corresponding implementation to assert against.
 */
import rawHardCases from "./hard-cases.json";

export interface HardCase {
  id: string;
  message: string;
  challenge: string;
  v1_1_behavior: string;
  expected: string;
  note: string;
}

export const hardCases = rawHardCases as HardCase[];
