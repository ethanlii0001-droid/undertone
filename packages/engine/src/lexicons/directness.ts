/**
 * CCSARP nine-level directness scale (Blum-Kulka et al.), mapped onto an
 * operational 0–10 base surface-strategy score, per LEXICON.md §1. Feeds
 * the surface scorer only. Matching is first-hit, most-direct-first
 * against pre-sorted patterns (LEXICON.md §0.4 rule 1); ties go to the
 * earliest span (SPEC.md §6). The ordering must remain strictly monotonic
 * from L1 to L9 when modifiers are held constant (SPEC.md §7.1).
 *
 * Transcribed verbatim from LEXICON.md §1 — pattern, weight, category,
 * subcategory, and note are copied as specified, including entries marked
 * "**Uncertain**" in their own note. Do not tune weights or patterns here;
 * fix LEXICON.md instead if an entry is wrong.
 */
import type { LexEntry } from "../types.js";

/**
 * Surface-side normalization constant for the directness base score
 * (LEXICON.md §0.1 `SCALE.surfaceStrategy`). Directness weights already
 * ARE the 0–10 base score, so this is the identity multiplier — named and
 * exported rather than inlined so surface/score.ts never writes a bare
 * numeric literal (CLAUDE.md rule 6).
 */
export const SURFACE_STRATEGY_SCALE = 1.0;

export const DIRECTNESS: LexEntry[] = [

  // ── Level 1 — Mood derivable (imperative). Base 10.0 ──────────────────────
  { pattern: /^\s*(?:hey\s+@?\w+[,:]?\s*)?(send|share|forward|upload|post|attach|submit|return)\b(?!ing)/i, weight: 10.0, category: "directness", subcategory: "mood_derivable", note: "Bare imperative with a transfer verb in clause-initial position — grammatical mood alone encodes the directive, the most direct realization available in English. `submit`/`return` are the same transfer-of-an-artifact frame as `send`, just directionally back to the sender's counterpart." },
  { pattern: /^\s*(?:hey\s+@?\w+[,:]?\s*)?(review|check|confirm|approve|sign|verify|look at|proofread)\b(?!ing)/i, weight: 10.0, category: "directness", subcategory: "mood_derivable", note: "Imperative with an evaluative verb; identical mood-derivable structure, listed separately so evidence subcategories stay interpretable in the UI. `proofread` is the same evaluative-scrutiny frame as `check`/`verify`." },
  { pattern: /^\s*(?:hey\s+@?\w+[,:]?\s*)?(fix|update|add|remove|delete|change|rename|merge|push|deploy|revert|swap|schedule)\b(?!ing)/i, weight: 10.0, category: "directness", subcategory: "mood_derivable", note: "Imperative with an action-on-artifact verb — the dominant imperative frame in engineering channels. `swap`/`schedule` are the same act-on-a-calendar-or-slot frame as `change`/`rename`." },
  { pattern: /^\s*please\s+(?!let me know|feel free|don't hesitate|ignore)\w+\b/i, weight: 10.0, category: "directness", subcategory: "mood_derivable", note: "Politeness marker plus bare verb is still imperative mood; *please* mitigates lexically but does not change the strategy level, so it is priced in downgraders.ts, not here." },
  { pattern: /\bgo ahead and\s+\w+/i, weight: 10.0, category: "directness", subcategory: "mood_derivable", note: "Permission-framed imperative; *go ahead* grants rather than requests, so the residue is an unhedged directive." },
  { pattern: /^\s*(make sure|be sure)\s+(to|you)\b/i, weight: 10.0, category: "directness", subcategory: "mood_derivable", note: "Imperative matrix verb taking the request as complement — mood is imperative even though the semantics read as obligation (see §0.3)." },
  { pattern: /^\s*(don'?t|do not|never|stop|hold off on)\s+\w+/i, weight: 10.0, category: "directness", subcategory: "mood_derivable", note: "Negative imperative; prohibitions are mood-derivable and carry no less directness than positive ones." },
  { pattern: /^\s*(get|grab|pull|put|drop|throw|write up|set up|spin up|loop)\s+\w+/i, weight: 10.0, category: "directness", subcategory: "mood_derivable", note: "Informal imperative verbs typical of Slack register; included because register-appropriate imperatives are frequently missed by formal-English pattern sets." },
  { pattern: /^\s*(action|todo|to-do|ask|next step)s?\s*[:\-—]/i, weight: 10.0, category: "directness", subcategory: "mood_derivable", note: "Labelled-directive convention in email and Teams; the label performs the illocution explicitly, functionally equivalent to imperative mood." },
  { pattern: /^\s*@\w+\s+(please\s+)?(send|review|fix|update|confirm|check|take)\b/i, weight: 10.0, category: "directness", subcategory: "mood_derivable", note: "Mention-addressed imperative — the @-mention supplies the addressee that imperative mood elides, making the directive fully explicit." },
  { pattern: /^\s*(ping|dm|message|call|email)\s+(me|@?\w+)\b/i, weight: 10.0, category: "directness", subcategory: "mood_derivable", note: "Imperative with a contact verb; extremely common and unambiguous in chat register." },

  // ── Level 2 — Explicit performative. Base 9.0 ──────────────────────────────
  { pattern: /\bI'?m asking (you )?to\b/i, weight: 9.0, category: "directness", subcategory: "performative", note: "Names the illocutionary act with the performative verb in the present progressive — maximally explicit about what is being done." },
  { pattern: /\bI'?m asking (that|you)\b/i, weight: 9.0, category: "directness", subcategory: "performative", note: "Same performative with a finite complement; equally explicit, different syntax." },
  { pattern: /\bI'?m requesting\b/i, weight: 9.0, category: "directness", subcategory: "performative", note: "Formal performative verb; rarer in chat but standard in procurement, HR, and compliance email." },
  { pattern: /\bI'?m telling you\b/i, weight: 9.0, category: "directness", subcategory: "performative", note: "Performative of assertion used directively; explicit and confrontational, hence no mitigation is present by construction." },
  { pattern: /\b(this is|consider this) (a|my|an official|a formal) (request|ask)\b/i, weight: 9.0, category: "directness", subcategory: "performative", note: "Metapragmatic labelling of the utterance as a request — explicitly performative even without a performative verb." },
  { pattern: /\bI'?m assigning (this|that|it) to you\b/i, weight: 9.0, category: "directness", subcategory: "performative", note: "Performative of task allocation; the speech act constitutes the assignment rather than reporting it." },
  { pattern: /\b(I'?m|I am) (formally |hereby )?(asking|requesting|instructing|directing)\b/i, weight: 9.0, category: "directness", subcategory: "performative", note: "Explicit performative with optional formality adverbs; *hereby* is the classic performative diagnostic." },
  { pattern: /\bmy ask (here )?is\b/i, weight: 9.0, category: "directness", subcategory: "performative", note: "Nominalized performative common in modern corporate register ('my ask is that you…'); names the act while foregrounding it as topic." },
  { pattern: /\bthe ask (here )?is\b/i, weight: 9.0, category: "directness", subcategory: "performative", note: "Agentless variant of the above; still explicitly labels the illocution, and the missing agent does not mitigate the act itself." },
    { pattern: /\bconsider this (your |a )?(notice|heads[- ]up that you (need|must))\b/i, weight: 9.0, category: "directness", subcategory: "performative", note: "Performative notification frame from HR and vendor email; the utterance constitutes the notice." },

  // ── Level 3 — Hedged performative. Base 8.0 ────────────────────────────────
  { pattern: /\bI'?d like to ask (you )?to\b/i, weight: 8.0, category: "directness", subcategory: "hedged_performative", note: "Performative verb embedded under a volitional matrix with conditional modality — the canonical CCSARP hedged performative." },
  { pattern: /\bI want(ed)? to ask (if|whether|you)\b/i, weight: 8.0, category: "directness", subcategory: "hedged_performative", note: "Performative under a want-verb; the past tense adds distance but the act is still named." },
  { pattern: /\bcan I ask (you )?to\b/i, weight: 8.0, category: "directness", subcategory: "hedged_performative", note: "Interrogative over the speaker's own asking — hedges the performative rather than the action, which is what distinguishes L3 from L7." },
  { pattern: /\bI(?:'?d| would) like to request\b/i, weight: 8.0, category: "directness", subcategory: "hedged_performative", note: "Formal register hedged performative; frequent in email to external parties." },
  { pattern: /\bI(?:'?m| am) going to have to ask (you )?to\b/i, weight: 8.0, category: "directness", subcategory: "hedged_performative", note: "Performative hedged by simulated external compulsion; the hedge shifts responsibility away from the speaker without weakening the act." },
  { pattern: /\bjust wanted to ask\b/i, weight: 8.0, category: "directness", subcategory: "hedged_performative", note: "Chat-register hedged performative; *just* is separately scored as a downgrader since it is not constitutive of the performative — unlike the L5 want-statement conditional (§0.2), it is a bolt-on downtoner, not part of the minimal formula. (Prompt 5 reconciliation: the past tense was previously also claimed here, but no downgraders.ts entry actually matches bare `wanted` when `just` intervenes before it, so that claim was unexecutable prose and has been dropped rather than inventing a pattern to match it.)" },
  { pattern: /\bmind if I ask (you )?to\b/i, weight: 8.0, category: "directness", subcategory: "hedged_performative", note: "Permission-seeking over the act of asking; hedges the performative through a preparatory condition on the speaker, not the hearer." },
  { pattern: /\bI (do )?need to ask (you )?to\b/i, weight: 8.0, category: "directness", subcategory: "hedged_performative", note: "Performative under a necessity matrix; the hedge is the framing of the ask as compelled rather than chosen." },
  { pattern: /\bI'?m hoping (I can|to) ask\b/i, weight: 8.0, category: "directness", subcategory: "hedged_performative", note: "Performative under a hope-verb — among the most heavily hedged forms that still name the illocution." },
  { pattern: /\bhave (a|one) ask for you\b/i, weight: 8.0, category: "directness", subcategory: "hedged_performative", note: "Nominalized performative with possessive framing; softer than 'my ask is' because it announces rather than states the request." },
  { pattern: /\bwanted to (flag|raise) (an ask|a request)\b/i, weight: 8.0, category: "directness", subcategory: "hedged_performative", note: "Announcement-of-performative common in Teams; the raising verb defers the act by one step." },

  // ── Level 4 — Obligation statement. Base 7.0 ───────────────────────────────
  { pattern: /\byou (need|have) to\b/i, weight: 7.0, category: "directness", subcategory: "obligation", note: "Predicates necessity directly of the addressee — obligation is asserted as fact rather than requested." },
  { pattern: /\byou'?ll (need|have) to\b/i, weight: 7.0, category: "directness", subcategory: "obligation", note: "Future-shifted obligation; the shift is temporal, not mitigating, so it holds full L4 weight." },
  { pattern: /\byou must\b/i, weight: 7.0, category: "directness", subcategory: "obligation", note: "Strongest deontic modal in English; formal register, common in compliance and security email." },
  { pattern: /\byou'?re (going to have|gonna have) to\b/i, weight: 7.0, category: "directness", subcategory: "obligation", note: "Colloquial obligation with an implied external source of necessity; register-appropriate for chat." },
  { pattern: /\bI need you to\b/i, weight: 7.0, category: "directness", subcategory: "obligation", note: "Obligation lands on the addressee despite the speaker-subject; see §0.3 for the ruling against L5." },
  { pattern: /\bI'?m (going to |gonna )?need you to\b/i, weight: 7.0, category: "directness", subcategory: "obligation", note: "Future/progressive framing of the same addressee obligation as `I need you to`; it does not name the speech act itself, so v1.1 classifies it conservatively as L4 rather than an explicit performative." },
  { pattern: /\bwe need you to\b/i, weight: 7.0, category: "directness", subcategory: "obligation", note: "Institutional-we variant; the plural source of the obligation makes it harder to refuse, but the strategy level is unchanged." },
  { pattern: /\bthis (needs|has) to be\b/i, weight: 7.0, category: "directness", subcategory: "obligation", note: "Agentless obligation predicated of the task; the addressee is recoverable only from context, which is why it does not reach L1." },
  { pattern: /\b[A-Za-z][A-Za-z0-9 _-]{0,40} needs (doing|a look)\b/i, weight: 7.0, category: "directness", subcategory: "obligation", note: "Agentless necessity construction (e.g. `the deck needs a look`), not an imperative. Emit only when the message has a resolvable addressee or prior same-object request context; highly elliptical `needs eyes` is excluded from v1.1 because its directive reading is not reproducible." },
  { pattern: /\b(it|that) needs to (be |get )?\w+/i, weight: 7.0, category: "directness", subcategory: "obligation", note: "Same agentless obligation with a pronominal subject; extremely common in standup threads." },
  { pattern: /\byou should\b/i, weight: 7.0, category: "directness", subcategory: "obligation", note: "Weakest deontic modal — assigned L4 for CCSARP fidelity but MUST trigger the automatic `syntactic.weak_deontic` downgrader (§2) so its effective score lands below other obligation forms." },
  { pattern: /\b(you'?re|you are) expected to\b/i, weight: 7.0, category: "directness", subcategory: "obligation", note: "Obligation attributed to an unnamed institutional source; the passive raises pressure while keeping the strategy at obligation." },
  { pattern: /\b(it'?s|this is) (your|on you to)\b/i, weight: 7.0, category: "directness", subcategory: "obligation", note: "Ownership-assignment obligation ('this is on you to close out'); asserts responsibility as an existing fact." },
  { pattern: /\brequired (to|that you)\b/i, weight: 7.0, category: "directness", subcategory: "obligation", note: "Adjectival obligation; standard in policy and audit communication." },

  // ── Level 5 — Want statement. Base 6.0 ─────────────────────────────────────
  { pattern: /\bI(?:\s+would|'?d)?\s+(?:really\s+)?like\b(?! to ask)/i, weight: 6.0, category: "directness", subcategory: "want", note: "States the speaker's desire and leaves the inference to the hearer; the conditional is absorbed under §0.2. (Prompt 5 reconciliation: the previous pattern required a literal space between `I` and the optional `would`/`'d` group — `\\bI (would |'?d )?...` — which can never match the contracted form `I'd like`, since there is no space between `I` and `'d`. Restructured so the whitespace requirement sits after the optional modal, not baked into a fixed `I ` prefix, so `I like`, `I would like`, `I'd like`, and their `really`-modified variants all match as intended.)" },
  { pattern: /\bI want\b(?!ed to ask)/i, weight: 6.0, category: "directness", subcategory: "want", note: "Bare want statement — direct about the desire, indirect about the directive, which is exactly CCSARP's L5." },
  { pattern: /\bI need\b(?! (you|to ask))/i, weight: 6.0, category: "directness", subcategory: "want", note: "Necessity predicated of the speaker rather than the hearer; the negative lookahead is what separates this from the L4 obligation form." },
  { pattern: /\bwe (need|want)\b(?! you to)/i, weight: 6.0, category: "directness", subcategory: "want", note: "Collective want statement; the plural subject broadens the beneficiary without changing the strategy." },
  { pattern: /\bI'?m looking for\b/i, weight: 6.0, category: "directness", subcategory: "want", note: "Want statement framed as a search; common when requesting information rather than action." },
  { pattern: /\bwhat I (need|want|'?m after) is\b/i, weight: 6.0, category: "directness", subcategory: "want", note: "Cleft want statement; the cleft foregrounds the desired object and is marginally more emphatic than the bare form." },
  { pattern: /\bI'?m hoping (for|to get|we can get)\b/i, weight: 6.0, category: "directness", subcategory: "want", note: "Want under a hope-verb — weaker desire predicate, but still a want statement; the mitigation is priced in downgraders." },
  { pattern: /\bI'?d love (to (get|have|see)|it if)\b/i, weight: 6.0, category: "directness", subcategory: "want", note: "Affective want statement typical of chat; the enthusiasm does not upgrade the strategy, it only softens the imposition." },
  { pattern: /\bit'?d be (great|helpful|good|useful) to (get|have)\b/i, weight: 6.0, category: "directness", subcategory: "want", note: "Impersonal want statement — the desire is attributed to no one, which is why it sits at the bottom of L5 rather than in L6." },
  { pattern: /\bwould be (great|good|helpful) if\b/i, weight: 6.0, category: "directness", subcategory: "want", note: "**Uncertain** — the conditional complement pushes this toward suggestory (L6); I kept it at L5 because the matrix predicate expresses evaluation of an outcome, not a proposal for joint action." },
  { pattern: /\bI'?m after\b/i, weight: 6.0, category: "directness", subcategory: "want", note: "Informal British-register want statement; frequent in UK workplace chat, hence included." },
  { pattern: /\b(hoping|looking) to get (this|that|it) (back|over|across)\b/i, weight: 6.0, category: "directness", subcategory: "want", note: "Want statement with a transfer nominal; the speaker's goal is stated and the required action is left implicit." },

  // ── Level 6 — Suggestory formula. Base 4.5 ─────────────────────────────────
  { pattern: /\bhow about\b/i, weight: 4.5, category: "directness", subcategory: "suggestory", note: "Canonical suggestory formula — proposes rather than requests, inviting the hearer to evaluate the proposal." },
  { pattern: /\bwhat if (you|we)\b/i, weight: 4.5, category: "directness", subcategory: "suggestory", note: "Hypothetical framing of the desired action; the irrealis mood makes refusal costless, which is the defining property of L6." },
  { pattern: /\bwhy don'?t (you|we)\b/i, weight: 4.5, category: "directness", subcategory: "suggestory", note: "Negative-interrogative suggestory; conventionalized as a proposal rather than a genuine question about reasons." },
  { pattern: /\b(let'?s|lets)\b(?! say| see if)/i, weight: 4.5, category: "directness", subcategory: "suggestory", note: "Inclusive hortative — the addressee is co-agent, which is why this is suggestory rather than imperative (§0.3)." },
  { pattern: /\bmaybe (you|we) (could|should|can)\b/i, weight: 4.5, category: "directness", subcategory: "suggestory", note: "Suggestory with an epistemic adverb; *maybe* is scored separately as a downtoner since it falls outside the minimal formula span." },
  { pattern: /\bwe could\b/i, weight: 4.5, category: "directness", subcategory: "suggestory", note: "Bare possibility statement functioning as a proposal; very high frequency in planning threads." },
  { pattern: /\b(one|another) option (is|would be)\b/i, weight: 4.5, category: "directness", subcategory: "suggestory", note: "Explicitly frames the desired action as one alternative among several — maximally non-committal while still on the table." },
  { pattern: /\b(might be|could be) worth\b/i, weight: 4.5, category: "directness", subcategory: "suggestory", note: "Evaluative suggestory; asserts the value of the action rather than requesting it." },
  { pattern: /\bshould we\b/i, weight: 4.5, category: "directness", subcategory: "suggestory", note: "Deliberative interrogative with inclusive subject; proposes joint action and solicits agreement." },
  { pattern: /\b(shall|do you want to) (we|jump|hop|sync)\b/i, weight: 4.5, category: "directness", subcategory: "suggestory", note: "Meeting-proposal formulae; conventionalized suggestories in calendar and scheduling contexts." },
  { pattern: /\b(thoughts on|open to) \w+ing\b/i, weight: 4.5, category: "directness", subcategory: "suggestory", note: "Solicits an opinion about an action the speaker wants taken — suggestory dressed as consultation." },
  { pattern: /\bcan we (look at|revisit|try)\b/i, weight: 4.5, category: "directness", subcategory: "suggestory", note: "**Uncertain** — inclusive *we* makes this suggestory, but the interrogative modal makes it look like L7; I ruled on the subject, because L7 requires the hearer as sole agent." },

  // ── Level 7 — Query preparatory. Base 3.5 ──────────────────────────────────
  { pattern: /\bcan you\b/i, weight: 3.5, category: "directness", subcategory: "query_preparatory", note: "Queries the ability precondition — the single most conventionalized indirect request in workplace English." },
  { pattern: /\bcould you\b/i, weight: 3.5, category: "directness", subcategory: "query_preparatory", note: "Conditional variant of the ability query; the conditional is scored separately as a downgrader because it is not constitutive of the strategy (cf. *can you*)." },
  { pattern: /\bwould you\b(?! mind)/i, weight: 3.5, category: "directness", subcategory: "query_preparatory", note: "Queries willingness rather than ability; same conventionalized indirect force." },
  { pattern: /\bwill you\b/i, weight: 3.5, category: "directness", subcategory: "query_preparatory", note: "Non-conditional willingness query; marginally more direct than *would you* but not enough to warrant a distinct level." },
  { pattern: /\b(are|were) you able to\b/i, weight: 3.5, category: "directness", subcategory: "query_preparatory", note: "Explicit ability query; the past-tense variant adds distance and is separately downgraded." },
  { pattern: /\bwould you be able to\b/i, weight: 3.5, category: "directness", subcategory: "query_preparatory", note: "Doubly-modalized ability query — heavily mitigated but structurally still a preparatory query." },
  { pattern: /\bdo you (have time|have a sec|have bandwidth) to\b/i, weight: 3.5, category: "directness", subcategory: "query_preparatory", note: "Queries the availability precondition; *bandwidth* is corporate register and belongs here rather than in a formal-English set." },
  { pattern: /\bany chance you could\b/i, weight: 3.5, category: "directness", subcategory: "query_preparatory", note: "Possibility query with an existential downtoner; among the most mitigated conventional requests in the corpus." },
  { pattern: /\bwould you mind\b/i, weight: 3.5, category: "directness", subcategory: "query_preparatory", note: "Queries the absence of objection — a negative preparatory condition, which is why refusal is grammatically easy." },
  { pattern: /\bis it possible to\b/i, weight: 3.5, category: "directness", subcategory: "query_preparatory", note: "Impersonal possibility query; removes the addressee from subject position while still targeting them." },
  { pattern: /\bdo you think you could\b/i, weight: 3.5, category: "directness", subcategory: "query_preparatory", note: "Ability query embedded under an opinion predicate; two layers of indirection, both separately downgraded." },
  { pattern: /\bmind (sending|sharing|taking|having|checking|giving)\b/i, weight: 3.5, category: "directness", subcategory: "query_preparatory", note: "Elliptical *would you mind* — subjectless chat register, very high frequency in Slack." },

  // ── Level 8 — Strong hint. Base 2.0 ────────────────────────────────────────
  { pattern: /\bI (still )?don'?t (have|see)\b/i, weight: 2.0, category: "directness", subcategory: "strong_hint", note: "States the absence of the request object; the requested action is recoverable from the object but never named." },
  { pattern: /\bhaven'?t (seen|got|received)\b/i, weight: 2.0, category: "directness", subcategory: "strong_hint", note: "Negative perception report referencing the request object — classic CCSARP strong hint." },
  { pattern: /\b(is|'?s) still (missing|empty|blank|outstanding)\b/i, weight: 2.0, category: "directness", subcategory: "strong_hint", note: "Predicates absence of the artifact; *still* implies a prior expectation, which is what makes it strong rather than mild." },
  { pattern: /\bnothing (came through|in there|yet) (on|for|from)\b/i, weight: 2.0, category: "directness", subcategory: "strong_hint", note: "Existential negative about the request object; names the object, so the inference is short." },
  { pattern: /\bno (sign of|update on|word on)\b/i, weight: 2.0, category: "directness", subcategory: "strong_hint", note: "Nominalized absence report; the referenced object makes the required action recoverable." },
  { pattern: /\b(hasn'?t|didn'?t) (land|come through|show up|arrive)\b/i, weight: 2.0, category: "directness", subcategory: "strong_hint", note: "Negative event report about the expected delivery; hints at the action by describing its non-occurrence." },
  { pattern: /\bthe (folder|doc|sheet|channel|ticket) (is|'?s) (still )?empty\b/i, weight: 2.0, category: "directness", subcategory: "strong_hint", note: "State description of the destination rather than the object — one inferential step further out, still strong." },
  { pattern: /\bcan'?t find (the|your|any)\b/i, weight: 2.0, category: "directness", subcategory: "strong_hint", note: "Speaker-inability report that presupposes the object should exist; hints at supply without requesting it." },
  { pattern: /\bnot sure (if|whether) (this|that|it) (ever )?(went|got) (out|sent)\b/i, weight: 2.0, category: "directness", subcategory: "strong_hint", note: "Epistemic hedge over a delivery event; hints while preserving deniability that any request was made." },
  { pattern: /\bwe'?re (short|missing) (a|the|one)\b/i, weight: 2.0, category: "directness", subcategory: "strong_hint", note: "Collective shortfall report naming the missing item; the plural subject diffuses the addressing." },
  { pattern: /\b(don'?t think|not sure) (I|we) (ever )?got\b/i, weight: 2.0, category: "directness", subcategory: "strong_hint", note: "Hedged non-receipt report; among the softest forms that still names the request object." },

  // ── Level 9 — Mild hint. Base 1.0 ──────────────────────────────────────────
  // GATE: emit only if a prior same-sender head act at L1–L8 exists in the thread
  // with request-signature Jaccard ≥ 0.30 (`SPEC.md` §11.4).
  { pattern: /\b(going to be|'?s going to be|is) tight\b/i, weight: 1.0, category: "directness", subcategory: "mild_hint", note: "Predicts difficulty without referencing any request object; interpretable as a request only against prior thread context." },
  { pattern: /\bcutting it (a bit )?(close|fine)\b/i, weight: 1.0, category: "directness", subcategory: "mild_hint", note: "Idiomatic schedule-risk assessment; hints at urgency with no object and no addressee." },
  { pattern: /\b(not much|running out of) (time|runway|room)\b/i, weight: 1.0, category: "directness", subcategory: "mild_hint", note: "Resource-scarcity statement; requires the hearer to supply both the object and the required action." },
  { pattern: /\bwe'?re (a bit )?behind\b/i, weight: 1.0, category: "directness", subcategory: "mild_hint", note: "Collective status report; the request reading depends entirely on the thread's prior head act." },
  { pattern: /\b(clock'?s ticking|down to the wire)\b/i, weight: 1.0, category: "directness", subcategory: "mild_hint", note: "Idiomatic time pressure with no propositional content about the task; maximally indirect." },
  { pattern: /\bit'?s been (a while|a few days|quiet)\b/i, weight: 1.0, category: "directness", subcategory: "mild_hint", note: "Elapsed-time observation; hints at non-response without asserting that anything is owed." },
  { pattern: /\b(this|that) one'?s gone quiet\b/i, weight: 1.0, category: "directness", subcategory: "mild_hint", note: "Metacomment on thread inactivity; a request only by implicature from the prior ask." },
  { pattern: /\b(lot|a lot) to get through before\b/i, weight: 1.0, category: "directness", subcategory: "mild_hint", note: "Workload statement preceding a deadline reference; hints at prioritization without naming an action." },
  { pattern: /\bstarting to (worry|get nervous) about\b/i, weight: 1.0, category: "directness", subcategory: "mild_hint", note: "Affective state report; the hearer must infer both that a request exists and that they are its target." },
  { pattern: /\b(just|only) (two|three|a couple of) days (left|to go)\b/i, weight: 1.0, category: "directness", subcategory: "mild_hint", note: "Countdown statement — temporal content without a deadline predicate, which is why it hints rather than deadlines." },
  { pattern: /\bhow'?s (this|that|it) looking\b/i, weight: 1.0, category: "directness", subcategory: "mild_hint", note: "**Uncertain** — a status question that functions as a nudge; arguably L8 since it references the object, but the object is pronominal and recoverable only from context, so I placed it at L9." },
];

/**
 * CCSARP level (1–9) for each canonical directness subcategory. Derived
 * transparently from this lexicon's own level structure above (the
 * "Level N" section banners in LEXICON.md §1) — not a second,
 * independently authored strategy inventory. headAct.ts uses this to
 * populate HeadAct.ccsarpLevel from whichever DIRECTNESS entry matched.
 */
export const DIRECTNESS_LEVEL_BY_SUBCATEGORY: Readonly<Record<string, number>> = {
  mood_derivable: 1,
  performative: 2,
  hedged_performative: 3,
  obligation: 4,
  want: 5,
  suggestory: 6,
  query_preparatory: 7,
  strong_hint: 8,
  mild_hint: 9,
};
