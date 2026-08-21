import type { Evidence } from "@undertone/engine/src/types";
import { segmentText } from "@/lib/spans";
import { evidenceTooltip } from "@/lib/format";

interface EvidenceTextProps {
  text: string;
  surfaceEvidence: Evidence[];
  forceEvidence: Evidence[];
}

/**
 * Renders a message's original text with its Evidence spans highlighted, at
 * the engine's own character offsets (Prompt 9A §5). Never recomputes a
 * match — only slices `text` at spans the engine already returned.
 */
export function EvidenceText({ text, surfaceEvidence, forceEvidence }: EvidenceTextProps) {
  const allEvidence = [...surfaceEvidence, ...forceEvidence];
  const segments = segmentText(text, allEvidence);

  return (
    <p className="leading-relaxed text-[0.95rem]">
      {segments.map((segment) => {
        if (segment.evidence.length === 0) {
          return <span key={segment.start}>{segment.text}</span>;
        }

        const hasSurface = segment.evidence.some((e) => e.scorer === "surface");
        const hasForce = segment.evidence.some((e) => e.scorer === "force");
        const className = hasSurface && hasForce ? "ev-both" : hasSurface ? "ev-surface" : "ev-force";
        const label = segment.evidence.map(evidenceTooltip).join("\n\n");

        return (
          <mark key={segment.start} className={className} tabIndex={0} aria-label={label} title={label}>
            {segment.text}
            <span className="ev-tooltip" aria-hidden="true">
              {label}
            </span>
          </mark>
        );
      })}
    </p>
  );
}
