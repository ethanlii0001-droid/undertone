import type { MessageAnalysis } from "@undertone/engine/src/types";
import type { EditorMessage } from "@/lib/types";
import { EvidenceText } from "./EvidenceText";
import {
  formatBand,
  formatConfidence,
  formatGap,
  formatScore,
  explainGap,
  explainSuppression,
  isBaselineOnlyForce,
  baselineOnlyGapNote,
  BASELINE_ONLY_FORCE_NOTE,
  SURFACE_HELPER,
  FORCE_HELPER,
  GAP_HELPER,
} from "@/lib/format";

interface MessageResultProps {
  message: EditorMessage;
  analysis: MessageAnalysis;
  index: number;
}

export function MessageResult({ message, analysis, index }: MessageResultProps) {
  const sender = message.sender.trim() || `Sender ${index + 1}`;
  const recipient = message.recipient.trim() || "(unresolved)";
  const hasEvidence = analysis.surfaceEvidence.length > 0 || analysis.forceEvidence.length > 0;
  const baselineOnly = !analysis.suppressed && isBaselineOnlyForce(analysis);
  const baselineNote = baselineOnly ? baselineOnlyGapNote(analysis.gap) : null;

  return (
    <article
      className="border rounded-sm p-5 sm:p-6"
      style={{ borderColor: "var(--hairline)", background: "var(--paper-raised)" }}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <span className="text-xs uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
          {sender} → {recipient}
        </span>
        <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
          Message {index + 1}
        </span>
      </header>

      {hasEvidence && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2 text-[0.7rem]" style={{ color: "var(--ink-muted)" }}>
          <span className="inline-flex items-center gap-1.5">
            <span className="legend-swatch legend-swatch-surface" aria-hidden="true" />
            Surface evidence
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="legend-swatch legend-swatch-force" aria-hidden="true" />
            Force evidence
          </span>
        </div>
      )}

      <EvidenceText
        text={message.text}
        surfaceEvidence={analysis.surfaceEvidence}
        forceEvidence={analysis.forceEvidence}
      />

      {analysis.suppressed ? (
        <p
          className="mt-4 text-sm italic border-t pt-3"
          style={{ color: "var(--ink-muted)", borderColor: "var(--hairline)" }}
        >
          {explainSuppression(analysis.suppressed)}
        </p>
      ) : (
        <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--hairline)" }}>
          {/* Primary: the gap and its band — this is the result. */}
          <div className="metric-label">Pragmatic gap</div>
          <div className="text-[0.7rem] leading-snug mt-0.5 max-w-prose" style={{ color: "var(--ink-faint)" }}>
            {GAP_HELPER}
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-1">
            <span className="gap-value">{formatGap(analysis.gap)}</span>
            <span className="band-tag">{formatBand(analysis.band)}</span>
          </div>
          <p className="text-sm mt-2 max-w-prose" style={{ color: "var(--ink-muted)" }}>
            {explainGap(analysis.gap, analysis.band)}
          </p>
          {baselineNote && (
            <p className="text-xs mt-1.5 italic max-w-prose" style={{ color: "var(--ink-faint)" }}>
              {baselineNote}
            </p>
          )}

          {/* Secondary: the two input measurements whose difference produces the gap. */}
          <div className="mt-5 flex flex-wrap gap-x-10 gap-y-4">
            <Measurement label="Surface" helper={SURFACE_HELPER} value={formatScore(analysis.surface)} />
            <Measurement
              label="Communicative force"
              helper={FORCE_HELPER}
              value={formatScore(analysis.force)}
              note={baselineOnly ? BASELINE_ONLY_FORCE_NOTE : undefined}
            />
          </div>
          <p className="font-numeric text-xs mt-2" style={{ color: "var(--ink-faint)" }}>
            force {formatScore(analysis.force)} − surface {formatScore(analysis.surface)} = gap{" "}
            {formatGap(analysis.gap)}
          </p>

          {/* Tertiary: confidence. */}
          <p className="text-xs mt-4" style={{ color: "var(--ink-faint)" }}>
            Confidence {formatConfidence(analysis.confidence?.value ?? null)}
          </p>
        </div>
      )}
    </article>
  );
}

function Measurement({
  label,
  helper,
  value,
  note,
}: {
  label: string;
  helper: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="min-w-[9rem]">
      <div className="metric-label">{label}</div>
      <div className="text-[0.7rem] leading-snug mt-0.5 max-w-[16rem]" style={{ color: "var(--ink-faint)" }}>
        {helper}
      </div>
      <div className="font-numeric text-2xl font-medium mt-1" style={{ color: "var(--ink)" }}>
        {value}
        <span className="text-xs font-normal ml-1" style={{ color: "var(--ink-faint)" }}>
          / 10
        </span>
      </div>
      {note && (
        <div className="text-[0.7rem] italic mt-1 max-w-[16rem]" style={{ color: "var(--ink-faint)" }}>
          {note}
        </div>
      )}
    </div>
  );
}
