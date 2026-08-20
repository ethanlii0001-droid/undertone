/**
 * Patterns describing social/structural pressure: another person, task,
 * process, or deliverable blocked on the requested action, or a concrete
 * accountability commitment, per LEXICON.md §6. Feeds the force scorer
 * only.
 *
 * Transcribed verbatim from LEXICON.md §6 — pattern, weight, category,
 * subcategory, and note are copied as specified. Do not tune weights or
 * patterns here; fix LEXICON.md instead if an entry is wrong.
 *
 * IMPORTANT (LEXICON.md wins on category assignment): every entry here
 * keeps category "dependency" exactly as LEXICON.md §6 authors it, even
 * for the "follow_up" and "accountability" subcategories — do NOT retag
 * these to category "follow_up"/"accountability" merely because
 * types.ts's EvidenceCategory union happens to also list those as
 * standalone category values (they are used elsewhere, e.g. for synthetic
 * escalation evidence — see force/escalation.ts — not for these lexical
 * entries).
 *
 * Job title, seniority, department, and organizational rank must not
 * change this weight (SPEC.md §8.1 point 4) — v1 models the presence and
 * specificity of textual accountability, not power.
 *
 * No pattern here may ever be evaluated against unmasked text (LEXICON.md
 * §0.4 rule 5; SPEC.md §10). "follow_up" subcategory entries route to the
 * repetition/escalation component, not the ordinary dependency component
 * (SPEC.md §11.3; force/score.ts) — do not double-count them.
 */
import type { LexEntry } from "../types.js";

/**
 * Force-side normalization constant applied to every dependency entry's
 * raw weight (LEXICON.md §0.1 `SCALE.dependency`). Raw weights are
 * unsigned salience magnitudes; dependency/accountability contributions
 * are never negative — there are no force mitigators (SPEC.md §8).
 */
export const DEPENDENCY_SCALE = 0.8;

export const DEPENDENCY: LexEntry[] = [

  // ── (a) Dependency framing ────────────────────────────────────────────────
  { pattern: /\bwaiting on\b/i, weight: 2.0, category: "dependency", subcategory: "framing", note: "States that a party is in a suspended state pending the hearer's action; assigned here rather than to L8 hints per §0.3." },
  { pattern: /\bblocked on\b/i, weight: 2.2, category: "dependency", subcategory: "framing", note: "Stronger than waiting — asserts that work has stopped, not merely that it is pending." },
  { pattern: /\bblocked (until|without)\b/i, weight: 2.2, category: "dependency", subcategory: "framing", note: "Blockage tied to a missing precondition; same dependency event as `blocked on`, with a different connective." },
  { pattern: /\bblocker\b/i, weight: 2.2, category: "dependency", subcategory: "framing", note: "Engineering-register label for a dependency that has stopped progress; canonical home for `blocker` so the same blockage event cannot also score as a consequence." },
  { pattern: /\b(is|are|it'?s) blocking\b/i, weight: 2.2, category: "dependency", subcategory: "framing", note: "Active blockage predicate; dependency-only in v1.1 to prevent consequence/dependency double-counting." },
  { pattern: /\bbefore (we|I|they) can\b/i, weight: 2.2, category: "dependency", subcategory: "framing", note: "Explicit precedence constraint; makes the hearer's action a logical precondition for someone else's." },
  { pattern: /\bso (that )?(we|I|they) can\b/i, weight: 1.8, category: "dependency", subcategory: "framing", note: "Purpose clause naming a downstream beneficiary; weaker than precedence because it states enablement rather than blockage." },
  { pattern: /\bholding up\b/i, weight: 2.2, category: "dependency", subcategory: "framing", note: "Assigns responsibility for a delay to the outstanding item; the possessive framing implicates the hearer directly." },
  { pattern: /\bdependent on (this|your|you)\b/i, weight: 2.0, category: "dependency", subcategory: "framing", note: "Explicit dependency predicate; names the relation rather than describing its effects." },
  { pattern: /\bcan(?:not|'?t) (start|move|finish) (until|without)\b/i, weight: 2.2, category: "dependency", subcategory: "framing", note: "Inability plus precedence connective; combines the two strongest dependency structures in one clause." },
  { pattern: /\bgating\b/i, weight: 2.2, category: "dependency", subcategory: "framing", note: "Project-register dependency verb; names the item as a formal gate on downstream work." },
  { pattern: /\bthe last (piece|thing) (we'?re|I'?m) missing\b/i, weight: 2.0, category: "dependency", subcategory: "framing", note: "Positions the hearer's item as the sole remaining obstacle, which concentrates all residual pressure on them." },
  { pattern: /\bcritical path\b/i, weight: 2.2, category: "dependency", subcategory: "framing", note: "Project-management term of art asserting that delay propagates directly to the end date; institutionally precise." },
  { pattern: /\beverything else is (ready|done|in)\b/i, weight: 1.8, category: "dependency", subcategory: "framing", note: "Completion-contrast framing; implies sole outstanding responsibility without stating it, and is common immediately before a nudge." },
  { pattern: /\bstuck (on|without)\b/i, weight: 2.0, category: "dependency", subcategory: "framing", note: "Colloquial blockage predicate; same function as *blocked on* in more informal register." },

  // ── (b) Follow-up markers ─────────────────────────────────────────────────
  { pattern: /\bfollowing up\b/i, weight: 1.8, category: "dependency", subcategory: "follow_up", note: "Explicitly marks the message as a repetition, which asserts that a prior expectation went unmet — force from sequence, not content." },
  { pattern: /\bcircling back\b/i, weight: 1.8, category: "dependency", subcategory: "follow_up", note: "Corporate-register repetition marker; identical function to *following up*." },
  { pattern: /\bbumping this\b/i, weight: 2.0, category: "dependency", subcategory: "follow_up", note: "Chat-native repetition marker; the metaphor of raising the message in a feed makes the non-response explicit." },
  { pattern: /\bany update\b/i, weight: 1.8, category: "dependency", subcategory: "follow_up", note: "Status solicitation presupposing an owed deliverable; the presupposition is what carries the force." },
  { pattern: /\bchecking in (again|on this)\b/i, weight: 2.0, category: "dependency", subcategory: "follow_up", note: "*Again* explicitly counts the repetition, which is a stronger escalation signal than an unmarked follow-up." },
  { pattern: /\bresurface\b/i, weight: 1.8, category: "dependency", subcategory: "follow_up", note: "Metapragmatic repetition marker. Match only `resurface`; any preceding `wanted to` is surface-side distancing and may be masked." },
  { pattern: /\b(nudge|reminder|bump)\b/i, weight: 1.6, category: "dependency", subcategory: "follow_up", note: "Follow-up noun indicating repetition. Match the noun only; modifiers such as `gentle` remain surface-side wording." },
  { pattern: /\bas (mentioned|discussed|per my last)\b/i, weight: 2.0, category: "dependency", subcategory: "follow_up", note: "Explicit reference to a prior request; asserts that the current message should not have been necessary." },
  { pattern: /\bstill (chasing|waiting)\b/i, weight: 2.2, category: "dependency", subcategory: "follow_up", note: "`Still` plus a pursuit/waiting predicate marks continued non-fulfilment without relying on a head-act obligation modal." },
  { pattern: /\breminder (that|to)\b/i, weight: 1.6, category: "dependency", subcategory: "follow_up", note: "Explicit repetition nominal; neutral in tone but presupposes a prior communication." },
  { pattern: /\bpinging again\b/i, weight: 2.0, category: "dependency", subcategory: "follow_up", note: "Chat-register repetition with an explicit count marker; same structure as *checking in again*." },
  { pattern: /\bthird time\b/i, weight: 2.4, category: "dependency", subcategory: "follow_up", note: "Explicit numeric repetition count; naming the number is a marked escalation move rarely made casually." },

  // ── (c) Accountability invocation ─────────────────────────────────────────
  // v1.1 NON-HIERARCHY RULE: job title, seniority, department, and organizational rank
  // never change the weight. Named/concrete accountability sources use raw 2.2; unnamed
  // sources use raw 1.8. Any larger score must come from an independently stated deadline,
  // consequence, or dependency — never from who sounds more powerful.
  { pattern: /\bthe client is (asking|waiting|chasing)\b/i, weight: 2.2, category: "dependency", subcategory: "accountability", note: "Names a concrete external accountability source. The weight comes from specificity and the stated dependency, not from the client's status or leverage." },
  { pattern: /\b(leadership|the exec team|the board) (wants|is asking|needs)\b/i, weight: 2.2, category: "dependency", subcategory: "accountability", note: "Names a concrete accountability source. v1.1 assigns the same weight as any other named source; organizational seniority is not modeled." },
  { pattern: /\bI told them\b/i, weight: 2.2, category: "dependency", subcategory: "accountability", note: "Reports a concrete prior commitment by the speaker; the force comes from the commitment event, not from the identity or rank of the third party." },
  { pattern: /\bI'?ve (got|got someone) (waiting|asking)\b/i, weight: 1.8, category: "dependency", subcategory: "accountability", note: "Reports an unnamed waiting party. It is lower than a named source only because the accountability event is less specific, not because of status." },
  { pattern: /\bI committed to\b/i, weight: 2.2, category: "dependency", subcategory: "accountability", note: "Explicit prior commitment by the speaker; the commitment itself creates accountability independent of anyone's organizational rank." },
  { pattern: /\b(promised|said) (it|we'?d|this would) (be|land|go out)\b/i, weight: 2.2, category: "dependency", subcategory: "accountability", note: "Reports a concrete promise or commitment; identical weighting regardless of who the commitment was made to." },
  { pattern: /\b@?\w+ is (asking|waiting|expecting)\b/i, weight: 2.2, category: "dependency", subcategory: "accountability", note: "Names a specific individual as an accountability source. Specificity, not title or seniority, licenses the weight." },
  { pattern: /\b(finance|legal|security|compliance) (needs|is asking for|requires)\b/i, weight: 2.2, category: "dependency", subcategory: "accountability", note: "Names a concrete process or team as an accountability source. The department name does not add authority weight in v1.1." },
  { pattern: /\bit'?s on the (board|exec|leadership) (report|deck|update)\b/i, weight: 2.2, category: "dependency", subcategory: "accountability", note: "Names a concrete downstream deliverable and audience. The weight comes from the explicit accountability link, not the audience's seniority." },
  { pattern: /\bmy (manager|boss|lead) (is asking|wants|flagged)\b/i, weight: 2.2, category: "dependency", subcategory: "accountability", note: "Names a concrete third-party accountability source. Managerial rank does not alter the weight; it is treated like any other named source." },
  { pattern: /\bthey'?re asking me (for|about)\b/i, weight: 1.8, category: "dependency", subcategory: "accountability", note: "Reports an unnamed accountability source. The lower weight reflects underspecification only, not lower organizational power." },
  { pattern: /\bI'?m the one who has to\b/i, weight: 1.8, category: "dependency", subcategory: "accountability", note: "Names a concrete consequence borne by the speaker; this is self-accountability and contains no hierarchy inference." },
];
