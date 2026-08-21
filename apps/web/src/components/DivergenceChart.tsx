import type { MessageAnalysis } from "@undertone/engine/src/types";
import { formatGap } from "@/lib/format";

interface ScoredPoint {
  index: number;
  surface: number;
  force: number;
  gap: number;
}

interface DivergenceChartProps {
  analyses: MessageAnalysis[];
}

const WIDTH = 640;
const HEIGHT = 280;
const PAD_LEFT = 34;
const PAD_RIGHT = 20;
const PAD_TOP = 20;
const PAD_BOTTOM = 30;
const MAX_VALUE = 10;

/**
 * Hand-rolled SVG line chart (Prompt 9A §4, refined in 9B §5) — surface vs.
 * communicative force across scored requests in message order, with the
 * single largest-magnitude gap called out explicitly so the divergence
 * reads within a few seconds. Renders nothing (parent decides) when fewer
 * than two scored requests exist, since a one-point line chart has nothing
 * to show.
 */
export function DivergenceChart({ analyses }: DivergenceChartProps) {
  const points: ScoredPoint[] = analyses
    .map((a, index) => ({ a, index }))
    .filter(({ a }) => a.surface !== null && a.force !== null && a.gap !== null)
    .map(({ a, index }) => ({ index, surface: a.surface as number, force: a.force as number, gap: a.gap as number }));

  if (points.length < 2) return null;

  const innerWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const innerHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const x = (i: number) => PAD_LEFT + (i / (points.length - 1)) * innerWidth;
  const y = (v: number) => PAD_TOP + innerHeight - (v / MAX_VALUE) * innerHeight;

  const surfacePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.surface)}`).join(" ");
  const forcePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.force)}`).join(" ");

  const gapArea =
    points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.surface)}`).join(" ") +
    " " +
    [...points]
      .reverse()
      .map((p, i) => `L${x(points.length - 1 - i)},${y(p.force)}`)
      .join(" ") +
    " Z";

  const gridValues = [0, 5, 10];

  const widestGap = points.reduce((max, p) => (Math.abs(p.gap) > Math.abs(max.gap) ? p : max), points[0]!);
  const widestGapIndex = points.indexOf(widestGap);
  const nearRightEdge = widestGapIndex >= points.length - 2 && points.length > 2;
  const annotationX = x(widestGapIndex);
  const annotationTopY = Math.min(y(widestGap.surface), y(widestGap.force));
  const annotationBottomY = Math.max(y(widestGap.surface), y(widestGap.force));
  const annotationMidY = (annotationTopY + annotationBottomY) / 2;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Surface strength and communicative force across the thread. The largest pragmatic gap is ${formatGap(widestGap.gap)}, at message ${widestGap.index + 1}.`}
        className="w-full h-auto"
        style={{ minWidth: 460 }}
      >
        {gridValues.map((v) => (
          <g key={v}>
            <line
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--hairline)"
              strokeWidth={1}
            />
            <text x={4} y={y(v) + 3} fontSize={10} fill="var(--ink-muted)" fontFamily="var(--font-geist-mono)">
              {v}
            </text>
          </g>
        ))}

        <path d={gapArea} fill="var(--accent-soft)" stroke="none" />

        <path d={forcePath} fill="none" stroke="var(--force-line)" strokeWidth={2.5} strokeDasharray="6 3" />
        <path d={surfacePath} fill="none" stroke="var(--surface-line)" strokeWidth={2.5} />

        {points.map((p, i) => (
          <g key={`pts-${p.index}`}>
            <circle cx={x(i)} cy={y(p.surface)} r={3.5} fill="var(--surface-line)" />
            <circle cx={x(i)} cy={y(p.force)} r={3.5} fill="var(--force-line)" />
            <text
              x={x(i)}
              y={HEIGHT - 10}
              fontSize={10}
              textAnchor="middle"
              fill="var(--ink-muted)"
              fontFamily="var(--font-geist-mono)"
            >
              #{p.index + 1}
            </text>
          </g>
        ))}

        {/* Callout for the single largest-magnitude gap. */}
        <line
          x1={annotationX}
          x2={annotationX}
          y1={annotationTopY}
          y2={annotationBottomY}
          stroke="var(--accent)"
          strokeWidth={1.5}
          strokeDasharray="2 2"
        />
        <text
          x={annotationX + (nearRightEdge ? -8 : 8)}
          y={annotationMidY + 4}
          fontSize={13}
          fontWeight={600}
          textAnchor={nearRightEdge ? "end" : "start"}
          fill="var(--accent)"
          fontFamily="var(--font-geist-mono)"
        >
          {formatGap(widestGap.gap)}
        </text>
      </svg>

      <div className="flex flex-wrap gap-4 mt-2 text-xs" style={{ color: "var(--ink-muted)" }}>
        <Legend swatchColor="var(--surface-line)" label="Surface" dashed={false} />
        <Legend swatchColor="var(--force-line)" label="Communicative force" dashed />
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            style={{ width: 10, height: 10, background: "var(--accent-soft-strong)", display: "inline-block", borderRadius: 2 }}
          />
          Gap (largest: {formatGap(widestGap.gap)} at #{widestGap.index + 1})
        </span>
      </div>
    </div>
  );
}

function Legend({ swatchColor, label, dashed }: { swatchColor: string; label: string; dashed: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width="16" height="8" aria-hidden="true">
        <line
          x1={0}
          y1={4}
          x2={16}
          y2={4}
          stroke={swatchColor}
          strokeWidth={2}
          strokeDasharray={dashed ? "5 3" : undefined}
        />
      </svg>
      {label}
    </span>
  );
}
