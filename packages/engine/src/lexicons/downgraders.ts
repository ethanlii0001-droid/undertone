/**
 * Internal-modification patterns that mitigate/soften a request's phrasing
 * — hedges, understaters, subjectivizers, cajolers, and optionality/
 * deferral formulas such as "no rush", "whenever you get a chance", "no
 * pressure" — per LEXICON.md §2. Feeds the surface scorer only.
 *
 * Never force evidence, regardless of clause/sentence position within the
 * message (LEXICON.md §0.3 collision table). There are no negative-weight
 * force mitigators in v1.1 (SPEC.md §7.2).
 *
 * Transcribed verbatim from LEXICON.md §2 — pattern, weight, category,
 * subcategory, and note are copied as specified, including entries marked
 * "**contested**"/"**uncertain**" in their own note. Do not tune weights
 * or patterns here; fix LEXICON.md instead if an entry is wrong.
 */
import type { LexEntry } from "../types.js";

/**
 * Surface-side normalization constant applied to every downgrader's raw
 * weight (LEXICON.md §0.1 `SCALE.downgrader`). Raw weights are unsigned
 * salience magnitudes; this constant supplies both the sign and the scale
 * of a downgrader's contribution.
 */
export const DOWNGRADER_SCALE = -0.4;

export const DOWNGRADERS: LexEntry[] = [

  // ── Syntactic: interrogative ───────────────────────────────────────────────
  { pattern: /\?\s*$/, weight: 1.0, category: "downgrader", subcategory: "syntactic.interrogative", note: "Interrogative mood on a directive gives the hearer a grammatically licensed 'no', converting a demand into a question that can be answered rather than obeyed." },
  { pattern: /\b(right|yeah|ok|okay)\?\s*$/i, weight: 1.2, category: "downgrader", subcategory: "syntactic.interrogative", note: "Tag question appended to a directive solicits agreement, reframing compliance as something negotiated rather than owed." },

  // ── Syntactic: negation of preparatory condition ───────────────────────────
  { pattern: /\bI don'?t suppose\b/i, weight: 2.6, category: "downgrader", subcategory: "syntactic.negation", note: "Pre-negates the hearer's ability or willingness, building the expected refusal into the request itself — among the strongest mitigators in English." },
  { pattern: /\byou (couldn'?t|wouldn'?t) .{0,40}(could|would) you\b/i, weight: 2.4, category: "downgrader", subcategory: "syntactic.negation", note: "Negative-interrogative frame presupposes inability, making refusal the unmarked response." },
  { pattern: /\bif (it'?s|that'?s) not (too much|a hassle|a pain)\b/i, weight: 1.8, category: "downgrader", subcategory: "syntactic.negation", note: "Negated imposition condition; explicitly raises the cost to the hearer as a reason to decline." },
  { pattern: /\bI (know|realise|realize) (this is|it'?s) (a lot|short notice|annoying)\b/i, weight: 1.4, category: "downgrader", subcategory: "syntactic.negation", note: "Pre-emptive acknowledgment of imposition; concedes the grounds for refusal before the hearer raises them." },

  // ── Syntactic: past tense / distancing ─────────────────────────────────────
  { pattern: /\bI wanted to\b/i, weight: 1.6, category: "downgrader", subcategory: "syntactic.past_tense", note: "Past tense on a present desire creates temporal distance, presenting the want as a completed prior state rather than a live demand." },
  { pattern: /\bI was hoping\b/i, weight: 2.0, category: "downgrader", subcategory: "syntactic.past_tense", note: "Past progressive on a weak desire predicate — doubly distanced, and *hoping* concedes the outcome is not the speaker's to determine." },
  { pattern: /\bI was going to ask\b/i, weight: 2.0, category: "downgrader", subcategory: "syntactic.past_tense", note: "Frames the request as one previously contemplated rather than currently made, giving the hearer room to treat it as optional." },
  { pattern: /\bI was thinking\b/i, weight: 1.6, category: "downgrader", subcategory: "syntactic.past_tense", note: "Past progressive over a cognition verb; presents the request as an unfinished thought rather than a settled position." },
  { pattern: /\bI'?d meant to\b/i, weight: 1.4, category: "downgrader", subcategory: "syntactic.past_tense", note: "Past perfect distancing; frames the ask as overdue on the speaker's side, which shifts fault away from the hearer." },

  // ── Syntactic: embedded if-clause ──────────────────────────────────────────
  { pattern: /\bI was wondering if\b/i, weight: 2.8, category: "downgrader", subcategory: "syntactic.embedded_if", note: "Stacks past tense, progressive aspect, a cognition verb, and an embedded interrogative — the maximally mitigated request frame in English." },
  { pattern: /\bI wonder if\b/i, weight: 2.2, category: "downgrader", subcategory: "syntactic.embedded_if", note: "Present-tense variant of the above; one layer less distanced but still buries the directive two clauses deep." },
  { pattern: /\bwondering if you (could|might|would)\b/i, weight: 2.6, category: "downgrader", subcategory: "syntactic.embedded_if", note: "Subjectless chat variant with a modal complement; three simultaneous mitigators." },
  { pattern: /\bif you could\b/i, weight: 1.8, category: "downgrader", subcategory: "syntactic.embedded_if", note: "Conditionalizes the entire request on the hearer's ability, making non-compliance a satisfied condition rather than a refusal." },
  { pattern: /\bif (you'?re|you are) able to\b/i, weight: 1.8, category: "downgrader", subcategory: "syntactic.embedded_if", note: "Explicit ability condition; same structure as above with the precondition spelled out." },
  { pattern: /\bI don'?t know if you'?d (be able|want|have time)\b/i, weight: 2.8, category: "downgrader", subcategory: "syntactic.embedded_if", note: "Epistemic disclaimer plus embedded conditional plus modal — the speaker declines to assert even that the request is answerable." },

  // ── Syntactic: conditional modality ────────────────────────────────────────
  { pattern: /\bcould\b/i, weight: 1.0, category: "downgrader", subcategory: "syntactic.conditional", note: "Conditional past of *can*; the counterfactual modality removes the presupposition that the hearer will comply. Absorbed under §0.2 where it is part of the matched strategy." },
  { pattern: /\bwould\b/i, weight: 1.0, category: "downgrader", subcategory: "syntactic.conditional", note: "Conditional past of *will*; same counterfactual mitigation applied to willingness rather than ability." },
  { pattern: /\bmight\b/i, weight: 1.2, category: "downgrader", subcategory: "syntactic.conditional", note: "Epistemic possibility modal — weaker than *could* because it does not even presuppose the hearer's capacity." },
  { pattern: /\byou should\b/i, weight: 0.8, category: "downgrader", subcategory: "syntactic.weak_deontic", note: "Automatic companion downgrader for the L4 obligation entry (§0.3); prices *should* as the weakest deontic modal without breaking CCSARP's category assignment." },

  // ── Politeness markers ─────────────────────────────────────────────────────
  { pattern: /\bplease\b/i, weight: 0.8, category: "downgrader", subcategory: "politeness_marker", note: "CCSARP classes *please* as a lexical downgrader; **contested**, since it also marks the utterance unambiguously as a request — kept small so the ruling has limited influence on the final surface score." },
  { pattern: /\bif you (would|could) be so kind\b/i, weight: 1.4, category: "downgrader", subcategory: "politeness_marker", note: "Deferential formula; rare and slightly arch in workplace register, which is itself mitigating because it signals the speaker knows they are imposing." },
  { pattern: /\b(thanks|thank you) in advance\b/i, weight: 0.6, category: "downgrader", subcategory: "politeness_marker", note: "Pre-emptive gratitude; softens the imposition, though it arguably presupposes compliance — **uncertain**, and it may deserve a weight near zero." },
  { pattern: /\bsorry to (bother|bug|ask|chase)\b/i, weight: 1.6, category: "downgrader", subcategory: "politeness_marker", note: "Apology for the speech act itself; concedes the request is an imposition the hearer has grounds to resent." },
  { pattern: /\bapologies for the (chase|nudge|noise)\b/i, weight: 1.4, category: "downgrader", subcategory: "politeness_marker", note: "Nominalized apology for a follow-up; mitigates the escalation that a repeat request would otherwise signal." },

  // ── Consultative devices ───────────────────────────────────────────────────
  { pattern: /\bdo you think\b/i, weight: 1.4, category: "downgrader", subcategory: "consultative", note: "Solicits the hearer's judgment before the request lands, framing compliance as a shared decision." },
  { pattern: /\bwhat do you (think|reckon)\b/i, weight: 1.6, category: "downgrader", subcategory: "consultative", note: "Explicit opinion solicitation; hands the hearer control over whether the request proceeds at all." },
  { pattern: /\bwould it be (ok|okay|alright|possible)\b/i, weight: 1.6, category: "downgrader", subcategory: "consultative", note: "Seeks permission for the request; conditional plus permission-seeking is two independent mitigators." },
  { pattern: /\bdoes that (work|make sense) for you\b/i, weight: 1.4, category: "downgrader", subcategory: "consultative", note: "Post-hoc consultation appended to a directive; converts the utterance into a proposal awaiting ratification." },
  { pattern: /\bup to you\b/i, weight: 2.6, category: "downgrader", subcategory: "consultative", note: "Explicitly transfers the decision to the hearer, cancelling the directive force of whatever preceded it." },
  { pattern: /\btotally up to you\b/i, weight: 3.0, category: "downgrader", subcategory: "consultative", note: "Intensified decision-transfer — the strongest mitigator in the inventory, because it explicitly denies that any expectation exists." },
  { pattern: /\byour call\b/i, weight: 2.6, category: "downgrader", subcategory: "consultative", note: "Idiomatic decision-transfer; identical function to *up to you* in shorter register." },
  { pattern: /\bhappy either way\b/i, weight: 2.4, category: "downgrader", subcategory: "consultative", note: "Declares speaker indifference to the outcome, removing the preference that makes a request a request." },
  { pattern: /\bfeel free to (ignore|say no|push back)\b/i, weight: 3.0, category: "downgrader", subcategory: "consultative", note: "Explicit pre-authorization of refusal; the most direct possible cancellation of expected compliance." },
  { pattern: /\bno (worries|problem) if not\b/i, weight: 2.6, category: "downgrader", subcategory: "consultative", note: "Pre-accepts refusal and disclaims any cost to it; extremely high frequency in Slack." },

  // ── Workplace mitigating formulae ──────────────────────────────────────────
  { pattern: /\bno rush\b/i, weight: 2.0, category: "downgrader", subcategory: "workplace_formula", note: "Cancels claimed time pressure but does not cancel the request itself; weaker than `feel free to ignore` or `totally up to you`, and surface-only wherever it appears." },
  { pattern: /\bno (pressure|stress)\b/i, weight: 2.6, category: "downgrader", subcategory: "workplace_formula", note: "Cancels the social obligation rather than the timeline — broader in scope than *no rush*, hence the higher weight." },
  { pattern: /\bdon'?t stress\b/i, weight: 2.4, category: "downgrader", subcategory: "workplace_formula", note: "Imperative reassurance directed at the hearer's affect; disclaims that the request should register as pressure." },
  { pattern: /\bwhenever you (get|have) (a chance|a sec|time)\b/i, weight: 2.4, category: "downgrader", subcategory: "workplace_formula", note: "Hands timing entirely to the hearer; the single most common way a real deadline gets erased in workplace chat." },
  { pattern: /\bif you (get|have) a (sec|second|minute|moment)\b/i, weight: 2.2, category: "downgrader", subcategory: "workplace_formula", note: "Conditionalizes on a trivially small time cost, understating the imposition while also making it deniable." },
  { pattern: /\bwhenever (works|suits|is good)\b/i, weight: 2.2, category: "downgrader", subcategory: "workplace_formula", note: "Open-ended scheduling deferral; explicitly declines to name a deadline." },
  { pattern: /\bonly if you have time\b/i, weight: 2.8, category: "downgrader", subcategory: "workplace_formula", note: "Restrictive conditional making the entire request contingent on spare capacity — near-total cancellation of expectation." },
  { pattern: /\bif (you'?ve|you have) got (a|the) (sec|time|bandwidth)\b/i, weight: 2.2, category: "downgrader", subcategory: "workplace_formula", note: "Capacity conditional in colloquial register; same function as above with an availability precondition." },
  { pattern: /\bjust a (thought|idea|suggestion)\b/i, weight: 2.4, category: "downgrader", subcategory: "workplace_formula", note: "Metapragmatically relabels the preceding utterance as non-directive, retroactively downgrading whatever was just said." },
  { pattern: /\bgentle(?=\s+(nudge|reminder|bump))\b/i, weight: 1.0, category: "downgrader", subcategory: "workplace_formula", note: "Softening adjective attached to a follow-up label; surface-only, while the follow-up noun may separately encode repetition on the force side." },
  { pattern: /\bnot a big deal\b/i, weight: 2.2, category: "downgrader", subcategory: "workplace_formula", note: "Explicitly denies the stakes; frequently co-occurs with genuinely high-stakes force markers, which is precisely the gap UnderTone exists to surface." },
  { pattern: /\b(low|no) priority\b/i, weight: 2.2, category: "downgrader", subcategory: "workplace_formula", note: "Explicit priority disclaimer; ranks the request below the hearer's existing work." },
  { pattern: /\bnot urgent\b/i, weight: 2.2, category: "downgrader", subcategory: "workplace_formula", note: "Negated urgency; cancels the temporal pressure a deadline elsewhere in the message may still assert." },
  { pattern: /\bwhen you can\b/i, weight: 2.0, category: "downgrader", subcategory: "workplace_formula", note: "Ability-conditioned timing; assigned to surface per §0.3 and explicitly excluded from temporal.ts." },
  { pattern: /\bat your convenience\b/i, weight: 2.0, category: "downgrader", subcategory: "workplace_formula", note: "Formal-email deferral of timing to the hearer; register-appropriate for external correspondence." },
  { pattern: /\bat your earliest convenience\b/i, weight: 1.8, category: "downgrader", subcategory: "workplace_formula", note: "Conventional hearer-deferral formula. It can sound mildly pressing in practice, but without an independent deadline it remains a surface softener rather than force evidence." },
  { pattern: /\bwhen you'?re (back|around|free)\b/i, weight: 1.8, category: "downgrader", subcategory: "workplace_formula", note: "Conditions action on the hearer's availability, so it softens the request instead of creating an independently measurable deadline." },
  { pattern: /\bwhenever it makes sense\b/i, weight: 2.0, category: "downgrader", subcategory: "workplace_formula", note: "Hands timing to the hearer's judgment; surface-only because it supplies no bounded temporal constraint." },
  { pattern: /\bI mean it\b/i, weight: 1.2, category: "downgrader", subcategory: "workplace_formula", note: "When adjacent to an optionality disclaimer, reinforces that the permission to decline is sincere; context-gated so ordinary repair uses of `I mean` are not double-counted." },
  { pattern: /\bno guilt( at all)?\b/i, weight: 1.8, category: "downgrader", subcategory: "workplace_formula", note: "Explicitly removes social cost from refusal; a strong surface-side optionality marker." },

  // ── Understaters ──────────────────────────────────────────────────────────
  { pattern: /\ba (bit|little|touch)\b/i, weight: 1.0, category: "downgrader", subcategory: "understater", note: "Minimizes the magnitude of the requested action, reducing the apparent cost of compliance and therefore the apparent seriousness." },
  { pattern: /\b(quick|quickly|super quick)\b/i, weight: 1.2, category: "downgrader", subcategory: "understater", note: "Understates the time cost; *quick look* is the canonical way a substantial review request gets minimized." },
  { pattern: /\b(small|minor|tiny|little) (thing|ask|favou?r|change|tweak)\b/i, weight: 1.4, category: "downgrader", subcategory: "understater", note: "Explicit size-minimizing nominal; understates scope directly rather than by adverb." },
  { pattern: /\bbriefly\b/i, weight: 1.0, category: "downgrader", subcategory: "understater", note: "Adverbial time-cost understater; frequent in meeting and review requests." },
  { pattern: /\bjust a (couple|few) of?\b/i, weight: 1.2, category: "downgrader", subcategory: "understater", note: "Quantity understater; presents a multi-item request as trivially enumerable." },
  { pattern: /\b(two|five) minutes?\b/i, weight: 1.2, category: "downgrader", subcategory: "understater", note: "Conventionalized time understatement rather than a literal estimate; not treated as a deadline (see temporal.ts exclusions)." },
  { pattern: /\bnothing (major|serious|urgent)\b/i, weight: 1.6, category: "downgrader", subcategory: "understater", note: "Negated-magnitude understater; disclaims severity while the request still stands." },

  // ── Hedges ────────────────────────────────────────────────────────────────
  { pattern: /\b(sort of|kind of|kinda|sorta)\b/i, weight: 1.0, category: "downgrader", subcategory: "hedge", note: "Approximator over the propositional content; signals the speaker is not committing to the precise formulation, which weakens commitment to the request." },
  { pattern: /\bsomehow\b/i, weight: 0.8, category: "downgrader", subcategory: "hedge", note: "Leaves the manner of compliance unspecified, which lowers the specificity of what is actually being asked." },
  { pattern: /\bor something\b/i, weight: 1.2, category: "downgrader", subcategory: "hedge", note: "Open-ended disjunct appended to the request object; signals the speaker will accept alternatives, reducing perceived obligation." },
  { pattern: /\bmore or less\b/i, weight: 0.8, category: "downgrader", subcategory: "hedge", note: "Approximator over standards of completion; lowers the bar the hearer must meet." },
  { pattern: /\b(roughly|ballpark)\b/i, weight: 0.8, category: "downgrader", subcategory: "hedge", note: "Precision hedge; common in data and estimate requests, where it materially reduces the implied effort." },
  { pattern: /\bwhatever (works|you think)\b/i, weight: 1.8, category: "downgrader", subcategory: "hedge", note: "Hands specification of the request to the hearer entirely; borders on a consultative device but hedges content rather than the decision." },

  // ── Subjectivizers ────────────────────────────────────────────────────────
  { pattern: /\bI think\b/i, weight: 1.2, category: "downgrader", subcategory: "subjectivizer", note: "Frames the request as personal opinion rather than institutional requirement, lowering its claim on the hearer." },
  { pattern: /\bI feel like\b/i, weight: 1.4, category: "downgrader", subcategory: "subjectivizer", note: "Affective subjectivizer — weaker epistemic standing than *I think*, and explicitly non-factual." },
  { pattern: /\bI'?m not sure (but|if)\b/i, weight: 1.8, category: "downgrader", subcategory: "subjectivizer", note: "Explicit uncertainty disclaimer preceding the request; concedes the speaker may be wrong that the request is warranted." },
  { pattern: /\bI (guess|suppose)\b/i, weight: 1.6, category: "downgrader", subcategory: "subjectivizer", note: "Low-confidence epistemic verb; signals the speaker has not fully committed to the request being necessary." },
  { pattern: /\bin my (view|opinion)\b/i, weight: 1.0, category: "downgrader", subcategory: "subjectivizer", note: "Explicit opinion frame; formal register, and marginally weaker as a mitigator because it also asserts standing." },
  { pattern: /\bit (feels|seems) like\b/i, weight: 1.2, category: "downgrader", subcategory: "subjectivizer", note: "Impersonal evidential; attributes the assessment to appearance rather than fact." },
  { pattern: /\bmy (sense|instinct) is\b/i, weight: 1.2, category: "downgrader", subcategory: "subjectivizer", note: "Nominalized subjectivizer common in senior-register chat; hedges the basis of the request." },

  // ── Downtoners ────────────────────────────────────────────────────────────
  { pattern: /\bjust\b/i, weight: 1.2, category: "downgrader", subcategory: "downtoner", note: "The highest-frequency mitigator in workplace English; minimizes the imposition of the entire clause it scopes over, and its ubiquity is a large part of why gaps form." },
  { pattern: /\bmaybe\b/i, weight: 1.2, category: "downgrader", subcategory: "downtoner", note: "Epistemic possibility adverb; marks the request as one option rather than an expectation." },
  { pattern: /\b(possibly|perhaps)\b/i, weight: 1.0, category: "downgrader", subcategory: "downtoner", note: "Formal-register possibility adverbs; identical function to *maybe* at slightly lower frequency." },
  { pattern: /\bany chance\b/i, weight: 1.6, category: "downgrader", subcategory: "downtoner", note: "Existential possibility downtoner; explicitly entertains that compliance may not be available." },
  { pattern: /\bat all\b/i, weight: 1.0, category: "downgrader", subcategory: "downtoner", note: "Negative-polarity minimizer typically co-occurring with *any chance*; lowers the floor of what would count as compliance." },
  { pattern: /\bby any chance\b/i, weight: 1.6, category: "downgrader", subcategory: "downtoner", note: "Fronted variant of the above; same function, distinct span, so listed separately for evidence clarity." },
  { pattern: /\bif possible\b/i, weight: 1.6, category: "downgrader", subcategory: "downtoner", note: "Post-posed possibility condition; conditionalizes compliance on unstated feasibility." },
  { pattern: /\bideally\b/i, weight: 1.4, category: "downgrader", subcategory: "downtoner", note: "Marks the stated requirement as an optimum rather than a threshold, licensing the hearer to deliver less." },
  { pattern: /\bpotentially\b/i, weight: 1.0, category: "downgrader", subcategory: "downtoner", note: "Corporate-register possibility adverb; weakens the assertion that the action is needed." },

  // ── Cajolers and appealers ────────────────────────────────────────────────
  { pattern: /\byou know\b/i, weight: 0.5, category: "downgrader", subcategory: "cajoler", note: "Solidarity marker invoking shared understanding; mitigates by treating the request as mutually obvious rather than imposed." },
  { pattern: /\bI mean\b/i, weight: 0.5, category: "downgrader", subcategory: "cajoler", note: "Repair marker that softens by signalling the formulation is provisional." },
  { pattern: /\bif that (works|makes sense|is ok)\b/i, weight: 1.8, category: "downgrader", subcategory: "appealer", note: "Post-posed ratification appeal; makes the request contingent on the hearer's agreement after the fact." },
  { pattern: /\bhope that'?s (ok|alright|fine)\b/i, weight: 1.8, category: "downgrader", subcategory: "appealer", note: "Appeals for retrospective consent; presupposes the request may have been unwelcome." },
  { pattern: /\blet me know if (that'?s|it'?s) (a problem|not doable|tricky)\b/i, weight: 2.0, category: "downgrader", subcategory: "appealer", note: "Pre-authorizes an objection channel, signalling that non-compliance is an acceptable outcome." },
];
