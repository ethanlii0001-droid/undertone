/**
 * The 120 core minimal pairs (20 per family) from EVAL.md, loaded verbatim.
 *
 * core-pairs.json is NOT hand-authored — it was mechanically extracted from
 * EVAL.md's six `## Family — ... (20 pairs)` fenced ```json blocks by
 * scripts/extract-eval-fixtures.mjs (parsed + JSON.stringify'd, byte content
 * unchanged), so this file cannot silently drift from EVAL.md by a typo
 * during transcription. Do not hand-edit core-pairs.json; if EVAL.md
 * changes, re-run the extraction script.
 *
 * Types below are copied from EVAL.md's own "Canonical fixture schema"
 * section (lines 19–52 as of this writing), not invented.
 */
import rawCorePairs from "./core-pairs.json";

export type Family =
  | "head-act-modality"
  | "head-act-strategy"
  | "internal-modification"
  | "external-only"
  | "deadline-specificity"
  | "escalation";

export interface ExpectedSurfaceManipulation {
  surfaceRelation: "a > b" | "b > a";
  minSurfaceDelta: number;
  forceDeltaMax: number;
  claim: string;
}

export interface ExpectedForceManipulation {
  surfaceDeltaMax: number;
  forceRelation: "a > b" | "b > a";
  minForceDelta: number;
  claim: string;
}

/** One message in a multi-message escalation-family fixture. Shape as used in EVAL.md's `escalation` family blocks. */
export interface TestThreadMessage {
  minutesBefore: number;
  sender: string;
  recipient: string;
  text: string;
}

export type TestThread = TestThreadMessage[];

export interface MessagePair {
  id: string;
  family: Family;
  /** Present on some head-act-strategy/internal-modification pairs, pointing back to the v1.0 pair it was adapted from. */
  sourceScenario?: string;
  a: string | TestThread;
  b: string | TestThread;
  expected: ExpectedSurfaceManipulation | ExpectedForceManipulation;
  note: string;
}

export const corePairs = rawCorePairs as MessagePair[];

export const FAMILIES: Family[] = [
  "head-act-modality",
  "head-act-strategy",
  "internal-modification",
  "external-only",
  "deadline-specificity",
  "escalation",
];

/** Families 1–3: force-bearing context fixed, surface realization varies (EVAL.md line 60). */
export const SURFACE_MANIPULATION_FAMILIES: Family[] = [
  "head-act-modality",
  "head-act-strategy",
  "internal-modification",
];

/** Families 4–6: request wording fixed, force-bearing evidence varies (EVAL.md line 60). */
export const FORCE_MANIPULATION_FAMILIES: Family[] = [
  "external-only",
  "deadline-specificity",
  "escalation",
];

export function pairsByFamily(family: Family): MessagePair[] {
  return corePairs.filter((pair) => pair.family === family);
}
