/**
 * Public API of the UnderTone engine: score(thread: Thread, config?:
 * Config) => ThreadAnalysis, per SPEC.md §3. The engine must be a pure
 * function — the same input and config always yield the same output and
 * the same evidence trace (SPEC.md §3; CLAUDE.md rule 1). Orchestrates the
 * shared-preprocessing + two-restricted-scoring-paths pipeline of SPEC.md
 * §5: segment -> identify head act -> score surface -> mask -> score force
 * (masked message + masked prior thread context only) -> confidence -> gap.
 */
import type { Config, GapBand, MaskedMessage, MessageAnalysis, SuppressionReason, Thread, ThreadAnalysis } from "./types.js";
import { segmentSentences } from "./segment.js";
import { identifyHeadAct } from "./headAct.js";
import { scoreSurface } from "./surface/score.js";
import { buildContextMaskedMessage, buildMaskedMessage } from "./mask.js";
import { scoreForce } from "./force/score.js";
import { computeConfidence } from "./force/confidence.js";

// ---------------------------------------------------------------------------
// Gap and band (SPEC.md §13) — named constants, never inline literals
// (CLAUDE.md rule 6).
// ---------------------------------------------------------------------------

const ROUND1_FACTOR = 10;

/** Rounds to one decimal place (SPEC.md §13's `round1`). */
function round1(value: number): number {
  return Math.round(value * ROUND1_FACTOR) / ROUND1_FACTOR;
}

/** SPEC.md §13's exact band cut points, named rather than inlined. */
const UNDER_PHRASED_MIN_GAP = 3.0;
const MILDLY_UNDER_PHRASED_MIN_GAP = 1.0;
const MILDLY_OVER_PHRASED_MAX_GAP = -1.0;
const OVER_PHRASED_MAX_GAP = -3.0;

/**
 * `gap = round1(force) - round1(surface)` (SPEC.md §13). The outer `round1`
 * around the subtraction is display-stability bookkeeping, not a second
 * rounding rule: `round1(force)` and `round1(surface)` each already carry
 * at most one decimal digit, so their exact mathematical difference is
 * already a one-decimal quantity — the outer `round1` only strips IEEE-754
 * subtraction noise (e.g. `1.2000000000000002`) back to that same clean
 * value, never changing what the formula computes.
 */
export function computeGap(force: number, surface: number): number {
  return round1(round1(force) - round1(surface));
}

/**
 * SPEC.md §13's five-band diagnostic classification (UnderTone-internal,
 * not a calibrated human-perception threshold), boundaries copied verbatim
 * from its table: `>= +3.0` under-phrased; `[+1.0, +3.0)`
 * mildly-under-phrased; `(-1.0, +1.0)` aligned; `(-3.0, -1.0]`
 * mildly-over-phrased; `<= -3.0` over-phrased. Reuses the existing
 * `GapBand` type/names from types.ts — no second band type is introduced.
 */
export function computeGapBand(gap: number): GapBand {
  if (gap >= UNDER_PHRASED_MIN_GAP) return "under-phrased";
  if (gap >= MILDLY_UNDER_PHRASED_MIN_GAP) return "mildly-under-phrased";
  if (gap > MILDLY_OVER_PHRASED_MAX_GAP) return "aligned";
  if (gap > OVER_PHRASED_MAX_GAP) return "mildly-over-phrased";
  return "over-phrased";
}

/** A suppressed MessageAnalysis (SPEC.md §4, §6.1): every score field null, no evidence, `suppressed` names the guard that fired. `headAct` is non-null only for the unresolved-addressee guard, which detects a real head act it still cannot score. */
function suppressedAnalysis(messageId: string, headAct: MessageAnalysis["headAct"], suppressed: SuppressionReason): MessageAnalysis {
  return {
    messageId,
    headAct,
    surface: null,
    force: null,
    gap: null,
    band: null,
    confidence: null,
    surfaceEvidence: [],
    forceEvidence: [],
    suppressed,
  };
}

/**
 * Scores every message in `thread.messages`, in the caller-supplied
 * (ascending-timestamp, SPEC.md §4) order. Pure — never mutates `thread`,
 * `config`, or any `Message` (CLAUDE.md rule 1): all thread-context state
 * lives in the local `priorMaskedMessages` accumulator built fresh on each
 * call.
 *
 * Every message — including a suppressed one and one suppressed for an
 * unresolved addressee — contributes a context-only `MaskedMessage`
 * (`mask.ts`'s `buildContextMaskedMessage`) to `priorMaskedMessages` so a
 * later request's escalation scoring (SPEC.md §11.4) can still see a prior
 * recipient reply like `"done"` for the completion-signal check, without
 * that non-request message ever being able to itself count as a verified
 * same-request mention (its `requestSignature` is `[]`) or without a
 * request this engine could not score (unresolved addressee) silently
 * seeding a verified-restatement chain. Only a message that was actually
 * fully scored (branch E below) contributes its real `buildMaskedMessage`
 * result instead.
 *
 * Per SPEC.md §5.1 / CLAUDE.md rule 3, `scoreForce` below receives only the
 * `MaskedMessage` for the current message plus prior `MaskedMessage`s and
 * `Config` — never the raw `Message`, `HeadAct`, surface strategy, or
 * surface score.
 */
export function score(thread: Thread, config?: Config): ThreadAnalysis {
  const priorMaskedMessages: MaskedMessage[] = [];
  const messages: MessageAnalysis[] = [];

  for (const message of thread.messages) {
    const sentences = segmentSentences(message.text);
    const headAct = identifyHeadAct(message.text, sentences);

    if (!headAct) {
      messages.push(suppressedAnalysis(message.id, null, "no_head_act"));
      priorMaskedMessages.push(buildContextMaskedMessage(message));
      continue;
    }

    if (message.recipientIds.length === 0) {
      messages.push(suppressedAnalysis(message.id, headAct, "unresolved_addressee"));
      priorMaskedMessages.push(buildContextMaskedMessage(message));
      continue;
    }

    const surfaceResult = scoreSurface(message, headAct);
    const masked = buildMaskedMessage(message, headAct, surfaceResult);
    const forceResult = scoreForce(masked, priorMaskedMessages, config);
    const confidence = computeConfidence(message, headAct, surfaceResult.evidence, forceResult.evidence);
    const gap = computeGap(forceResult.value, surfaceResult.value);
    const band = computeGapBand(gap);

    messages.push({
      messageId: message.id,
      headAct,
      surface: surfaceResult.value,
      force: forceResult.value,
      gap,
      band,
      confidence,
      surfaceEvidence: surfaceResult.evidence,
      forceEvidence: forceResult.evidence,
    });

    priorMaskedMessages.push(masked);
  }

  return { messages };
}
