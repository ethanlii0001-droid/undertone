import type { GapBand } from "@undertone/engine/src/types";
import { formatBand, formatGap, formatScore } from "@/lib/format";

/**
 * These four numbers and the evidence spans marked below are the real,
 * verified `score()` output for the "Deadline + dependency" sample thread
 * available on /analyze ("If it's not too much trouble, would you mind
 * sending over the budget numbers by Thursday? Finance is blocked on this
 * until they're in."), not an invented pairing (Prompt 10 final cleanup
 * #3). Hardcoded here rather than computed, per CLAUDE.md rule 1 — the
 * landing page never calls `score()` itself.
 */
const SURFACE_VALUE = 3.1;
const FORCE_VALUE = 6.8;
const GAP_VALUE = 3.7;
const BAND: GapBand = "under-phrased";

/**
 * Static product preview for the landing hero (Prompt 10B §2) — reuses the
 * real formatting helpers (`formatGap`/`formatBand`/`formatScore`) against
 * the hardcoded, verified sample numbers above, but never calls `score()`
 * on this page.
 */
export function HeroPreview() {
  return (
    <div
      className="border rounded-sm p-5 sm:p-6"
      style={{ borderColor: "var(--hairline)", background: "var(--paper-raised)" }}
    >
      <p className="text-[0.65rem] uppercase tracking-wide mb-3" style={{ color: "var(--ink-faint)" }}>
        Example result — not computed on this page
      </p>

      <div className="metric-label">Pragmatic gap</div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-1">
        <span className="gap-value" style={{ fontSize: "2.25rem" }}>
          {formatGap(GAP_VALUE)}
        </span>
        <span className="band-tag">{formatBand(BAND)}</span>
      </div>

      <div className="flex gap-8 mt-5">
        <MiniStat label="Surface" value={formatScore(SURFACE_VALUE)} raw={SURFACE_VALUE} color="var(--surface-line)" />
        <MiniStat
          label="Communicative force"
          value={formatScore(FORCE_VALUE)}
          raw={FORCE_VALUE}
          color="var(--force-line)"
        />
      </div>

      <p
        className="leading-relaxed text-[0.85rem] mt-5 pt-4 border-t"
        style={{ borderColor: "var(--hairline)" }}
        aria-hidden="true"
      >
        If it&rsquo;s not too much trouble, <mark className="ev-surface">would you mind</mark>{" "}
        sending over the budget numbers <mark className="ev-force">by Thursday</mark>? Finance is{" "}
        <mark className="ev-force">blocked on</mark> this until they&rsquo;re in.
      </p>
      <p className="sr-only">
        Example result, not computed on this page — the real UnderTone output for the
        &ldquo;Deadline + dependency&rdquo; sample thread available on the Analyze page. Surface
        3.1 out of 10, communicative force 6.8 out of 10, pragmatic gap +3.7, strongly
        under-phrased.
      </p>
    </div>
  );
}

function MiniStat({ label, value, raw, color }: { label: string; value: string; raw: number; color: string }) {
  const MAX_SCALE = 10;
  return (
    <div className="flex-1 min-w-[7rem]">
      <div className="metric-label">{label}</div>
      <div className="font-numeric text-xl font-medium mt-0.5" style={{ color: "var(--ink)" }}>
        {value}
        <span className="text-xs font-normal ml-1" style={{ color: "var(--ink-faint)" }}>
          / 10
        </span>
      </div>
      <div className="h-1.5 rounded-full mt-2 overflow-hidden" style={{ background: "var(--hairline)" }}>
        <div className="h-full rounded-full" style={{ width: `${(raw / MAX_SCALE) * 100}%`, background: color }} />
      </div>
    </div>
  );
}
