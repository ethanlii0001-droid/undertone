/**
 * Must fail if one underlying force event (deadline, blockage, consequence,
 * accountability commitment, or repetition) contributes to the force score
 * more than once outside an explicit component rule (SPEC.md §11; §17).
 */
import { describe, it } from "vitest";

describe("force event dedupe", () => {
  it.todo("fails if one underlying force event contributes more than once");
});
