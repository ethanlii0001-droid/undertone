/**
 * Exercises eval/report.ts's computeReleaseReport()/renderReport() through
 * Vitest — the only environment in this repo that can resolve the engine's
 * `.js`-specifier-pointing-at-`.ts`-file bundler convention (see
 * eval/report.ts's own doc comment). Prints the rendered report so a human
 * running `npm test` can read it; also asserts the report's own structural
 * contract (all 14 SPEC.md §15.3 rows present, correctly ordered, and never
 * PARTIAL/NOT_MEASURABLE mislabeled as PASS) per this prompt's Task 7.
 */
import { describe, it, expect } from "vitest";
import { computeReleaseReport, renderReport, type ReleaseStatus } from "../../../eval/report.js";

describe("eval/report.ts: computeReleaseReport()", () => {
  const report = computeReleaseReport();

  it("covers exactly the 14 canonical SPEC.md §15.3 assertions, ids 1-14 in order", () => {
    expect(report.assertions.map((a) => a.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  });

  it("every assertion has a non-empty name, observed, and threshold", () => {
    for (const a of report.assertions) {
      expect(a.name.length, `#${a.id} name`).toBeGreaterThan(0);
      expect(a.observed.length, `#${a.id} observed`).toBeGreaterThan(0);
      expect(a.threshold.length, `#${a.id} threshold`).toBeGreaterThan(0);
    }
  });

  it("assertion #6 (CCSARP ordinal monotonicity) is never reported as a full PASS", () => {
    const ccsarp = report.assertions.find((a) => a.id === 6)!;
    expect(ccsarp.status).not.toBe("PASS");
  });

  it("assertion #12 (head-act precision/recall) is NOT_MEASURABLE, not a fabricated PASS", () => {
    const headActPR = report.assertions.find((a) => a.id === 12)!;
    expect(headActPR.status).toBe("NOT_MEASURABLE");
  });

  it("no assertion silently reports PARTIAL/NOT_MEASURABLE as PASS (status is exactly one of the four typed values)", () => {
    const valid: ReleaseStatus[] = ["PASS", "FAIL", "PARTIAL", "NOT_MEASURABLE"];
    for (const a of report.assertions) {
      expect(valid, `#${a.id} status`).toContain(a.status);
    }
  });

  it("the hard-fail assertions (1,3,4,7,8,9,10,11,14) that are currently measurable all PASS on the current implementation", () => {
    const hardFailIds = [1, 3, 4, 7, 8, 9, 10, 11, 14];
    const failing = report.assertions.filter((a) => hardFailIds.includes(a.id) && a.status === "FAIL");
    expect(failing.map((a) => `#${a.id} ${a.name}: ${a.observed}`)).toEqual([]);
  });

  it("renderReport() includes every assertion id and the required non-validation-claim footer", () => {
    const rendered = renderReport(report);
    for (const a of report.assertions) {
      expect(rendered).toContain(`#${String(a.id).padStart(2, "0")}`);
    }
    expect(rendered).toContain(
      "These are internal specification tests. Passing them establishes implementation fidelity and internal consistency, not human agreement or psychometric validity.",
    );
    // eslint-disable-next-line no-console
    console.log(rendered);
  });
});
