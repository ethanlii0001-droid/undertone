/**
 * Patterns describing a stated downstream outcome if the requested action
 * does not occur, per LEXICON.md §5. Feeds the force scorer only.
 *
 * Transcribed verbatim from LEXICON.md §5 — pattern, weight, category,
 * subcategory, and note are copied as specified. Do not tune weights or
 * patterns here; fix LEXICON.md instead if an entry is wrong.
 *
 * No pattern here may ever be evaluated against unmasked text (LEXICON.md
 * §0.4 rule 5; SPEC.md §10). Subject to the same-span and same-event force
 * deduplication rules (LEXICON.md §0.4 rules 6–7; SPEC.md §11), and to the
 * force-attachment/leakage gate (LEXICON.md §5's own note; SPEC.md §10.1):
 * a sanction word inside requestClauseSpan does not independently score
 * merely because it is the requested action — see force/score.ts.
 */
import type { LexEntry } from "../types.js";

/**
 * Force-side normalization constant applied to every consequence entry's
 * raw weight (LEXICON.md §0.1 `SCALE.consequence`). Raw weights are
 * unsigned salience magnitudes; consequence contributions are never
 * negative — there are no force mitigators (SPEC.md §8).
 */
export const CONSEQUENCE_SCALE = 0.83;

export const CONSEQUENCE: LexEntry[] = [

  // ── (a) Conditional-consequence structures ────────────────────────────────
  { pattern: /\bif (we|I|you) don'?t .{0,60}(we'?ll|it'?ll|they'?ll|we will|we'?re going to)\b/i, weight: 3.0, category: "consequence", subcategory: "conditional.explicit_negative", note: "Full conditional linking non-compliance to a stated negative outcome — the most explicit expectation signal available, since it makes the cost of inaction propositional." },
  { pattern: /\bunless .{0,60}(we'?ll|we can'?t|it won'?t|they'?ll)\b/i, weight: 3.0, category: "consequence", subcategory: "conditional.explicit_negative", note: "Negative conditional connective; semantically equivalent to *if not* and equally explicit about the cost." },
  { pattern: /\botherwise\b/i, weight: 2.0, category: "consequence", subcategory: "conditional.generic", note: "Consequence connective without a specified outcome in the matched span; weaker than a full conditional because the cost is left to inference." },
  { pattern: /\bor (else|we'?re|we'?ll have to)\b/i, weight: 2.4, category: "consequence", subcategory: "conditional.explicit_negative", note: "Disjunctive threat structure; explicitly presents compliance and consequence as the only two branches." },
  { pattern: /\bif (this|that|it) (slips|doesn'?t land|isn'?t (in|done))\b/i, weight: 2.8, category: "consequence", subcategory: "conditional.explicit_negative", note: "Conditional with an explicit non-completion antecedent; names the failure mode directly." },
  { pattern: /\bif we miss (this|that|the)\b/i, weight: 3.0, category: "consequence", subcategory: "conditional.explicit_negative", note: "Conditional on deadline failure; presupposes a deadline exists and states what missing it costs." },
  { pattern: /\bwhich means (we|they|I) (can'?t|won'?t|have to)\b/i, weight: 2.6, category: "consequence", subcategory: "conditional.named_downstream", note: "Inferential connective spelling out a downstream constraint; asserts the consequence as already entailed rather than conditional." },
  { pattern: /\bthat (would|will) (mean|put us|leave us)\b/i, weight: 2.4, category: "consequence", subcategory: "conditional.named_downstream", note: "Consequence projection; states the resulting state without conditionalizing on the hearer's choice." },
  { pattern: /\bthe risk is\b/i, weight: 2.2, category: "consequence", subcategory: "conditional.generic", note: "Nominalized consequence framing; names that a cost exists and gestures at its shape." },
  { pattern: /\bworst case\b/i, weight: 2.0, category: "consequence", subcategory: "conditional.generic", note: "Scenario framing that foregrounds the cost of inaction; weaker because it explicitly marks the outcome as non-default." },
  { pattern: /\bif (it|this) doesn'?t (happen|go out|get done)\b/i, weight: 2.8, category: "consequence", subcategory: "conditional.explicit_negative", note: "Agentless non-completion conditional; avoids naming the hearer while still pricing their inaction." },
  { pattern: /\bcan'?t (move|proceed|go) forward (until|without)\b/i, weight: 2.8, category: "consequence", subcategory: "conditional.named_downstream", note: "Precedence constraint stated as a present inability; makes the hearer's action a strict precondition." },

  // ── (b) Sanction lexicon ──────────────────────────────────────────────────
  { pattern: /\bescalat(e|ing|ed|ion)\b/i, weight: 3.0, category: "consequence", subcategory: "sanction", note: "Names the transfer of the issue to a higher authority; the canonical workplace sanction and a near-explicit threat." },
  { pattern: /\bon hold\b/i, weight: 2.2, category: "consequence", subcategory: "sanction", note: "Names a suspended state resulting from non-delivery; consequential but reversible, hence mid-range." },
  { pattern: /\bcan(?:not|'?t) process\b/i, weight: 2.4, category: "consequence", subcategory: "sanction", note: "Institutional inability predicate; typical of finance, legal, and vendor workflows where the block is procedural." },
  { pattern: /\bwon'?t be able to\b/i, weight: 2.2, category: "consequence", subcategory: "sanction", note: "Future inability; asserts a downstream cost without naming the mechanism." },
  { pattern: /\bfinal notice\b/i, weight: 3.0, category: "consequence", subcategory: "sanction", note: "Explicitly marks the message as terminal in a sequence, implying a defined next step after non-compliance." },
  { pattern: /\bloop(ing)? in\b/i, weight: 2.6, category: "consequence", subcategory: "sanction", note: "Names the addition of a third party to the thread; a visibility sanction whose force comes from audience expansion rather than content." },
  { pattern: /\bflag(ging)? (this )?to\b/i, weight: 2.8, category: "consequence", subcategory: "sanction", note: "Names an upward report; near-synonymous with escalation and equally explicit about the consequence." },
  { pattern: /\bat risk\b/i, weight: 2.4, category: "consequence", subcategory: "sanction", note: "Project-management register for a jeopardized deliverable; institutionally meaningful because it usually triggers reporting." },
  { pattern: /\bmiss the (window|deadline|cutoff|slot)\b/i, weight: 2.8, category: "consequence", subcategory: "sanction", note: "Names an irreversible timing failure; irreversibility is what puts it above generic risk language." },
  { pattern: /\bslip(ping|s)? (the|to next)\b/i, weight: 2.4, category: "consequence", subcategory: "sanction", note: "Schedule-slippage predicate; standard in delivery contexts and understood as a reportable outcome." },
  { pattern: /\bbreach(ing)? (the )?(SLA|contract|terms)\b/i, weight: 3.0, category: "consequence", subcategory: "sanction", note: "Names a contractual failure with defined external penalties; the highest-consequence item in the inventory." },
  { pattern: /\bgo(es|ing)? to (legal|compliance|the board)\b/i, weight: 3.0, category: "consequence", subcategory: "sanction", note: "Names a specific escalation destination; specificity of the destination is what makes it maximal." },
  { pattern: /\bpull (the|this) (release|launch|feature)\b/i, weight: 2.8, category: "consequence", subcategory: "sanction", note: "Names cancellation of a dependent deliverable; a concrete, high-visibility consequence." },
  { pattern: /\breopen(ing)? (the )?(ticket|issue)\b/i, weight: 1.6, category: "consequence", subcategory: "sanction", note: "Procedural reversal; the mildest sanction here, since it restores a prior state rather than imposing a new cost." },
  { pattern: /\bstart (the )?(clock|SLA) (on|again)\b/i, weight: 2.2, category: "consequence", subcategory: "sanction", note: "Initiates a formal timer with defined consequences; force comes from the process it triggers." },
];
