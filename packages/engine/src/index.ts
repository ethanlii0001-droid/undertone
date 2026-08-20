/**
 * Public API of the UnderTone engine: score(thread: Thread, config?:
 * Config) => ThreadAnalysis, per SPEC.md §3. The engine must be a pure
 * function — the same input and config always yield the same output and
 * the same evidence trace (SPEC.md §3; CLAUDE.md rule 1).
 */
import type { Thread, ThreadAnalysis, Config } from "./types.js";

/**
 * Not implemented. Exists only so test/independence.test.ts (and other
 * test-first fixtures) can import a real function and fail on assertions
 * instead of on a missing-export error. Replace this body — never remove
 * the "not implemented" behavior by guessing at scoring logic here; the
 * scoring rules live in surface/score.ts and force/score.ts.
 */
export function score(_thread: Thread, _config?: Config): ThreadAnalysis {
  throw new Error("score() is not implemented yet");
}
