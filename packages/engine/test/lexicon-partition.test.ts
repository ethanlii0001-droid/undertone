/**
 * Must fail if a normalized surface form has a home in both the surface
 * and force lexicons without an explicit, non-overlapping span rule
 * (SPEC.md §17; LEXICON.md §0.3). Enforces the surface/force independence
 * claim (CLAUDE.md rule 3) at the lexicon level.
 */
import { describe, it } from "vitest";

describe("lexicon partition", () => {
  it.todo("fails on any surface form present in both a surface and a force lexicon");
});
