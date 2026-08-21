/**
 * Display-only formatting for engine output. Never recomputes a score or
 * invents evidence — takes the engine's own numbers/labels and renders them
 * as UI copy. Language here is constrained by CLAUDE.md rule 5: statements
 * describe the wording/message, never a sender's intent.
 */
import type { Evidence, GapBand, MessageAnalysis, SuppressionReason } from "@undertone/engine/src/types";
import { FORCE_BASELINE } from "@undertone/engine/src/force/score";

export function formatScore(value: number | null): string {
  if (value === null) return "—";
  return value.toFixed(1);
}

export function formatGap(gap: number | null): string {
  if (gap === null) return "—";
  const sign = gap > 0 ? "+" : "";
  return `${sign}${gap.toFixed(1)}`;
}

export function formatConfidence(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value * 100)}%`;
}

const BAND_LABEL: Record<GapBand, string> = {
  "under-phrased": "Strongly under-phrased",
  "mildly-under-phrased": "Mildly under-phrased",
  aligned: "Aligned",
  "mildly-over-phrased": "Mildly over-phrased",
  "over-phrased": "Strongly over-phrased",
};

export function formatBand(band: GapBand | null): string {
  if (band === null) return "—";
  return BAND_LABEL[band];
}

/** Gap explanatory copy per Prompt 9A §3 — exact required wording. */
export function explainGap(gap: number | null, band: GapBand | null): string {
  if (gap === null || band === null) return "";
  if (band === "aligned") {
    return "The wording and surrounding force are closely aligned.";
  }
  if (gap > 0) {
    return "The wording is at risk of being under-read.";
  }
  return "The wording is at risk of being over-read.";
}

const SUPPRESSION_COPY: Record<SuppressionReason, string> = {
  no_head_act: "No reproducible workplace request was detected in this message.",
  unresolved_addressee: "A request was detected, but the addressee could not be resolved.",
};

export function explainSuppression(reason: SuppressionReason): string {
  return SUPPRESSION_COPY[reason];
}

export function formatWeight(weight: number): string {
  const sign = weight > 0 ? "+" : "";
  return `${sign}${weight.toFixed(2)}`;
}

export function evidenceTooltip(evidence: Evidence): string {
  const scorerLabel = evidence.scorer === "surface" ? "Surface" : "Communicative force";
  return `${scorerLabel} · ${evidence.category}/${evidence.subcategory}\n"${evidence.trigger}" · ${formatWeight(evidence.weight)}`;
}

// ---------------------------------------------------------------------------
// Two-score model helper copy (Prompt 9B §2) — small, fixed captions, never
// describing sender intent.
// ---------------------------------------------------------------------------

export const SURFACE_HELPER = "How strongly the request is phrased";
export const FORCE_HELPER = "How strongly observable surrounding language makes action expected";
export const GAP_HELPER = "The difference between the two";

/**
 * True when communicative force sits exactly at SPEC.md §8's neutral
 * expectation-of-action floor with no independent pressure evidence at all
 * — i.e. nothing in `forceEvidence` actually added to the baseline. Reads
 * `weight` (never re-derives it) so it stays correct even if some future
 * force rule contributes a zero-weight informational entry alongside the
 * baseline (Prompt 9B §3: "zero positive-weight force Evidence events").
 */
export function isBaselineOnlyForce(analysis: Pick<MessageAnalysis, "force" | "forceEvidence">): boolean {
  if (analysis.force !== FORCE_BASELINE) return false;
  return !analysis.forceEvidence.some((ev) => ev.weight > 0);
}

export const BASELINE_ONLY_FORCE_NOTE = "Baseline — no independent force markers detected.";

/**
 * Prompt 9B §3's required explanation for a baseline-only force score that
 * still produces a positive (under-phrased-leaning) gap: the gap is real
 * and correctly computed, but it is being driven by how soft the surface
 * phrasing is, not by any detected external pressure.
 */
export function baselineOnlyGapNote(gap: number | null): string | null {
  if (gap === null || gap <= 0) return null;
  return "No independent force markers were detected; this gap mostly reflects how soft the phrasing is relative to UnderTone's neutral force baseline.";
}
