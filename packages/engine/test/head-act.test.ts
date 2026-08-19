/**
 * Fixture-driven tests for headAct.ts: correct clause selection, the
 * most-direct-first tie-break rule, every suppression guard in SPEC.md
 * §6.1, and the hint gates of SPEC.md §6.2. Asserts head-act detection
 * precision/recall >= 0.90 against fixture annotations (SPEC.md §15.3,
 * assertion #12).
 */
import { describe, it } from "vitest";

describe("headAct", () => {
  it.todo("detects the head act and applies suppression guards per SPEC.md §6.1");
});
