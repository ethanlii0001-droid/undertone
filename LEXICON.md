# UnderTone — LEXICON

**Version:** 1.1 (reconciled hackathon scope)

The canonical linguistic feature inventory. Six modules, all TypeScript-ready. **This file is the single source of truth for every lexical pattern, raw weight, and normalization constant.** `SPEC.md` may describe the scoring formula but MUST NOT duplicate hand-maintained weight tables.

Every entry has the shape:

```ts
interface LexEntry {
  pattern: string | RegExp;
  weight: number;
  category: string;
  subcategory: string;
  note: string;      // mandatory: what this form does pragmatically, and why this weight
}
```

**Scorer assignment.** Sections 1–3 (`directness`, `downgraders`, `upgraders`) feed the **surface** scorer. Sections 4–6 (`temporal`, `consequence`, `dependency`) feed the **force** scorer. The sets are disjoint at the string level; §0.3 lists every case where I was tempted to put a form in both, and how I ruled.

---

## 0. Normative preamble

### 0.1 Weight scales and normalization

These are the canonical normalization constants. Any contribution examples shown elsewhere are derived from these values; if another document disagrees, this table wins and the other document is defective. The scorers normalize:

```ts
export const SCALE = {
  surfaceStrategy: 1.0,   // directness weights ARE the base score, 0–10
  downgrader: -0.40,      // raw 0.5–3.0  →  contribution -0.20 .. -1.20
  upgrader:   +0.40,      // raw 0.5–2.5  →  contribution +0.20 .. +1.00
  temporal:   +0.60,      // raw 0–5.0    →  contribution  0.00 .. +3.00
  consequence:+0.83,      // raw 1.5–3.0  →  contribution +1.25 .. +2.50
  dependency: +0.80,      // raw 1.0–2.5  →  contribution +0.80 .. +2.00
} as const;
```

Raw weights are **salience magnitudes**, unsigned. Sign and scale are applied by the scorer, never baked into the lexicon. This keeps the lexicon reviewable as a linguistic document: a judge should be able to argue that "no pressure" is a stronger mitigator than "just" without having to reason about clamping.

V1.1 applies the transparent global surface-modifier clamp defined in `SPEC.md` §7 after normalization: the summed modifier delta is clamped to `[-3.0, +3.0]`. There are no additional hidden per-subcategory caps.

### 0.2 The absorption rule

If an internal-modifier span is **fully contained** within the span matched by the directness strategy pattern, it is absorbed and MUST NOT be scored separately.

Rationale: `"I'd like the deck"` matches want statement (L5, base 6.0). The conditional `'d` is constitutive of that strategy's canonical realization — CCSARP's want-statement examples are conditional by default. Counting it again as `syntactic.conditional` double-penalizes a form that is already priced in at the base. Without this rule, conditional strategies would be systematically under-scored relative to non-conditional ones and assertion #5 (ordinal monotonicity) would fail.

### 0.3 Collisions — every form I was tempted to list twice

| Form | Tempted | Ruling | Why |
|---|---|---|---|
| `ASAP`, `now`, `immediately`, `right away`, `first thing` | upgraders `time_intensifier` **and** temporal `immediate` | **temporal only (force)** | These assert something about the world's schedule, not about the grammatical force of the phrasing. Consequence: the `time_intensifier` upgrader subcategory is deleted, and temporal expressions with a real time constraint are force-side only. Simpler and more defensible than scoring the same time phrase twice. |
| `blocking`, `blocker`, `blocked`, `holding up` | upgraders / consequence / dependency | **dependency only (force)** | These all describe one blockage/dependency event. Giving the same event a consequence score and a dependency score double-counts it, so v1.1 gives blockage language one canonical home. |
| `critical`, `urgent`, `high priority` | uptoners **and** consequence | **upgraders only (surface)** | Genuinely a soft boundary — these are evaluative adjectives applied by the speaker, so they intensify the *phrasing* rather than describe an independently observable dependency. I could be argued out of this one; see §7 review item R3. |
| `no rush`, `whenever you get a chance`, `no pressure`, `only if you have time` | downgraders **and** force mitigation | **downgraders only (surface), regardless of clause/sentence position** | V1.1 has no negative-weight force mitigators. A softening expression changes how the request is phrased; it does not erase an independently stated deadline, consequence, dependency, accountability marker, or verified repetition. |
| `whenever` (bare), `whenever works` | downgraders **and** temporal `none`/`vague` | **downgraders only (surface)** | Consistent with the row above. Temporal rung `none` therefore does not match on `whenever`. |
| `still waiting on`, `waiting on` | directness L8 strong hint **and** dependency | **dependency only (force)** | It states a blocked state, which is dependency framing. L8 hints are restricted to *absence* descriptions (`I don't see X`), never *waiting* descriptions. |
| `just following up` | downtoner `just` **and** follow-up marker | **split into minimal non-overlapping spans** | `just` is surface evidence; `following up` is force-side repetition framing. Both may exist, but the repetition/follow-up component is capped jointly with verified thread escalation so one repeated request cannot be counted without bound. |
| `I need you to` | L4 obligation **and** L5 want | **L4 obligation** | The need is the speaker's but the obligation lands on the addressee. `I need X` (no infinitival complement with addressee subject) stays L5. |
| `you should` | L4 obligation **and** L6 suggestory | **L4, plus an automatic `syntactic.weak_deontic` downgrader** | Keeps CCSARP's category assignment intact while pricing the fact that *should* is the weakest deontic modal. Cleaner than inventing a level 4.5. |
| `let's` | L1 imperative **and** L6 suggestory | **L6 suggestory** | CCSARP treats inclusive-we hortatives as suggestory formulae; the addressee is grammatically co-agent, which is the definition of the category. |
| `make sure to` | L1 imperative **and** L4 obligation | **L1** | Surface form is a bare imperative; the obligation reading comes from *sure*, not from grammatical mood. |

### 0.4 Global matching rules

1. Directness matching is **first-hit, most-direct-first**. Arrays below are pre-sorted; do not re-sort.
2. All regexes are case-insensitive and use `\b` boundaries. No pattern may match across a sentence boundary.
3. Every matcher MUST emit the **minimal** span that licenses the match (see `just following up`).
4. A pattern that fires more than once in the same clause counts once at full weight unless an explicit rule below says otherwise.
5. No pattern in §§4–6 may ever be evaluated against unmasked text. See `SPEC.md` §10.
6. **Same-span force deduplication:** if two force patterns overlap substantially and describe the same pragmatic event, only the most specific match contributes.
7. **Same-event force deduplication:** distinct spans that restate one underlying blockage, consequence, deadline, accountability commitment, or repetition event share that component's cap; category labels do not make them independent evidence.
8. Lexical follow-up evidence and verified cross-message escalation share one combined repetition/escalation cap defined in `SPEC.md`; a phrase such as `third time` does not stack without limit with the fact that it is literally the third request.
9. **Surface modifier overlap deduplication** (Prompt 5 reconciliation): if two matched `downgraders.ts`/`upgraders.ts` spans nest — one fully contains the other — and encode the same underlying lexical construction, only the longest, most specific match contributes; the contained one does not also stack, unless an entry's own note explicitly says the components are intended to stack independently. Concrete cases in the current inventory: `up to you` inside `totally up to you`; `any chance` inside `by any chance`; `really` inside `really really`; `really` inside `really important`. For an equal-length tie, the more specific (non-fallback) entry wins. This rule is about one modifier span nested in another *modifier* span — it is unrelated to §0.2 absorption, which governs a modifier nested inside the *directness* strategy match, and it must never be used to drop two modifiers whose spans do not nest (e.g. `just` and `maybe` in the same clause both stand).

---

## 1. `directness.ts` — CCSARP nine-level scale

Ordered most-direct-first. `weight` is the base surface score for that level.

```ts
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
```

**Level-boundary summary of ambiguous cases:** `needs doing / needs a look` is resolved to L4 in v1.1; `needs eyes` is excluded. `I'm going to need you to` is resolved to L4 in this review pass. Remaining review cases are `would be great if` (L5 vs L6), `can we…` (L6 vs L7), and `how's this looking` (L8 vs L9). Unresolved cases remain flagged inline and are context-gated or conservative rather than duplicated across levels.

---

## 2. `downgraders.ts` — internal modification, mitigating

Raw weights 0.5–3.0. Scorer applies `SCALE.downgrader = -0.40`; the total surface modifier delta is then clamped as defined in `SPEC.md` §7.

```ts
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
```

**Entry count is generated by the build audit; do not hard-code this number in scoring logic.**

---

## 3. `upgraders.ts` — internal modification, intensifying

Raw weights 0.5–2.5. Scorer applies `SCALE.upgrader = +0.40`. Note the `time_intensifier` subcategory has been **deleted** per §0.3 — all urgency-time forms now live in `temporal.ts`.

```ts
export const UPGRADERS: LexEntry[] = [

  // ── Intensifiers ──────────────────────────────────────────────────────────
  { pattern: /\breally\b/i, weight: 1.0, category: "upgrader", subcategory: "intensifier", note: "Scalar intensifier over the predicate; raises the speaker's degree of commitment without changing the strategy level." },
  { pattern: /\bvery\b/i, weight: 0.8, category: "upgrader", subcategory: "intensifier", note: "Neutral degree intensifier; weaker than *really* in chat register because it reads as formal rather than emphatic." },
  { pattern: /\babsolutely\b/i, weight: 1.6, category: "upgrader", subcategory: "intensifier", note: "Maximizer admitting no degree; forecloses negotiation over the extent of compliance." },
  { pattern: /\bcompletely\b/i, weight: 1.2, category: "upgrader", subcategory: "intensifier", note: "Totality maximizer over the requested action; raises the completion standard." },
  { pattern: /\breally really\b/i, weight: 1.8, category: "upgrader", subcategory: "intensifier", note: "Reduplicated intensifier; the repetition itself signals that the unreduplicated form was expected to be insufficient." },
  { pattern: /\bso (much|badly)\b/i, weight: 1.0, category: "upgrader", subcategory: "intensifier", note: "Degree intensifier with affective loading; common in chat requests for help." },
  { pattern: /\bat all costs\b/i, weight: 2.2, category: "upgrader", subcategory: "intensifier", note: "Explicitly ranks the request above competing constraints; near the top of the intensifier scale." },
  { pattern: /\bwhatever it takes\b/i, weight: 2.0, category: "upgrader", subcategory: "intensifier", note: "Removes cost limits on compliance; intensifies by refusing to bound the imposition." },

  // ── Commitment indicators ─────────────────────────────────────────────────
  { pattern: /\bobviously\b/i, weight: 1.4, category: "upgrader", subcategory: "commitment", note: "Presents the requested action as self-evidently required, making disagreement socially costly." },
  { pattern: /\bclearly\b/i, weight: 1.2, category: "upgrader", subcategory: "commitment", note: "Evidential maximizer; asserts that the necessity of the request is not in dispute." },
  { pattern: /\bdefinitely\b/i, weight: 1.2, category: "upgrader", subcategory: "commitment", note: "Modal certainty marker; removes the hedging space a bare assertion would leave." },
  { pattern: /\bwithout (question|a doubt)\b/i, weight: 1.4, category: "upgrader", subcategory: "commitment", note: "Formulaic certainty maximizer; forecloses the hearer's grounds for challenge." },
  { pattern: /\bthere'?s no (way|question|option)\b/i, weight: 1.8, category: "upgrader", subcategory: "commitment", note: "Negated-possibility frame; asserts that no alternative to compliance exists." },
  { pattern: /\bneeds? to happen\b/i, weight: 1.6, category: "upgrader", subcategory: "commitment", note: "Agentless necessity assertion appended to a request; commits the speaker to the action's inevitability." },
  { pattern: /\bnon[- ]negotiable\b/i, weight: 2.4, category: "upgrader", subcategory: "commitment", note: "Explicitly cancels the negotiability that indirect phrasing would otherwise imply; near the ceiling of the scale." },

  // ── Lexical uptoners ──────────────────────────────────────────────────────
  { pattern: /\bcritical\b/i, weight: 2.0, category: "upgrader", subcategory: "lexical_uptoner", note: "Maximal evaluative adjective for task importance; assigned to surface per §0.3, though the force reading is arguable." },
  { pattern: /\burgent(ly)?\b/i, weight: 2.0, category: "upgrader", subcategory: "lexical_uptoner", note: "Explicit priority adjective; note it is *not* a deadline, since it names no resolvable time — that separation is what keeps §4 disjoint from §3." },
  { pattern: /\b(top|high|highest) priority\b/i, weight: 1.8, category: "upgrader", subcategory: "lexical_uptoner", note: "Explicit ranking against the hearer's other work; the mirror image of the *low priority* downgrader." },
  { pattern: /\bessential\b/i, weight: 1.6, category: "upgrader", subcategory: "lexical_uptoner", note: "Necessity adjective; asserts the action is a precondition rather than a preference." },
  { pattern: /\b(huge|massive|enormous)\b/i, weight: 1.2, category: "upgrader", subcategory: "lexical_uptoner", note: "Magnitude adjective applied to stakes or impact; colloquial register intensification." },
  { pattern: /\bserious(ly)?\b/i, weight: 1.4, category: "upgrader", subcategory: "lexical_uptoner", note: "Gravity marker; raises the perceived consequence class of the request." },
  { pattern: /\bbig deal\b/i, weight: 1.4, category: "upgrader", subcategory: "lexical_uptoner", note: "Colloquial stakes marker; the affirmative counterpart of the *not a big deal* downgrader." },
  { pattern: /\breally important\b/i, weight: 1.6, category: "upgrader", subcategory: "lexical_uptoner", note: "Intensified importance adjective; explicit and unhedged assertion of priority." },
  { pattern: /\bmust[- ]have\b/i, weight: 1.8, category: "upgrader", subcategory: "lexical_uptoner", note: "Requirements-register nominal; classifies the request as mandatory rather than desirable." },

  // ── Emphatic orthography and repetition ───────────────────────────────────
  { pattern: /\b[A-Z]{3,}\b/, weight: 1.2, category: "upgrader", subcategory: "emphatic_orthography", note: "All-caps content word is a prosodic shout in text; must exclude a whitelist of acronyms (EOD, COB, PR, QA, API) or it will fire constantly." },
  // A single `!` is deliberately NOT scored in v1.1: in workplace chat it is too ambiguous between warmth, enthusiasm, and force.
  { pattern: /!{2,}/, weight: 1.6, category: "upgrader", subcategory: "emphatic_orthography", note: "Repeated exclamation marks; unlike a single mark, repetition reliably signals urgency or frustration rather than friendliness." },
  { pattern: /\b(\w+)\s+\1\b/i, weight: 0.8, category: "upgrader", subcategory: "repetition", note: "Immediate lexical reduplication ('now now', 'today today'); marks insistence through redundancy." },
];
```

**Entry count is generated by the build audit; do not hard-code this number in scoring logic.**

---

## 4. `temporal.ts` — deadline specificity ladder

**Force only.** Six rungs, ordered. Matching returns the **highest** rung that fires, not the first — a message containing both "this week" and "Thursday 3pm" scores at the higher rung. This differs from directness matching and is deliberate: deadline specificity is a maximum, not a first-hit.

```ts
export type TemporalRung = "none" | "vague" | "relative" | "named_day" | "date_time" | "immediate";

export const TEMPORAL_RUNGS: Record<TemporalRung, number> = {
  none: 0, vague: 0.5, relative: 1.5, named_day: 3.0, date_time: 4.0, immediate: 5.0,
};
```

### Rung 0 — `none` (weight 0)

You asked for 15+ patterns per rung. I'm pushing back on this one: `none` is an **absence rung**, reached by exhaustion when no other rung fires. Padding it with 15 patterns would create matchers that can only ever fire alongside a downgrader, duplicating work the surface scorer already does. It gets a short list of *explicit* open-endedness markers, which are the only case where absence is positively asserted rather than merely inferred.

```ts
export const TEMPORAL_NONE: LexEntry[] = [
  { pattern: /\bno (hard |fixed |firm )?(deadline|date)\b/i, weight: 0, category: "temporal", subcategory: "none.explicit", note: "Explicitly asserts the absence of a deadline; scored at zero rather than negatively because the absence of pressure is the ladder's baseline, not a mitigator." },
  { pattern: /\bopen[- ]ended\b/i, weight: 0, category: "temporal", subcategory: "none.explicit", note: "Names the task as unbounded in time; same baseline reasoning." },
  { pattern: /\bnot time[- ]sensitive\b/i, weight: 0, category: "temporal", subcategory: "none.explicit", note: "Negated temporal sensitivity; explicit denial that timing matters." },
  { pattern: /\bno timeline (on this|yet)\b/i, weight: 0, category: "temporal", subcategory: "none.explicit", note: "Asserts that no schedule has been set; common in early-stage project threads." },
  { pattern: /\bbacklog(ged)?\b/i, weight: 0, category: "temporal", subcategory: "none.explicit", note: "Places the task in an unscheduled queue; a structural rather than lexical assertion of no deadline." },
  { pattern: /\bnice to have\b/i, weight: 0, category: "temporal", subcategory: "none.explicit", note: "Requirements-register marker of optionality; implies no date because the task itself is optional." },
  // NOTE: `whenever`, `whenever works`, `when you can`, `at your convenience` deliberately
  // absent — they belong to downgraders.ts per §0.3. Do not add them here.
];
```

### Rung 1 — `vague` (weight 0.5)

```ts
export const TEMPORAL_VAGUE: LexEntry[] = [
  { pattern: /\bsometime\b/i, weight: 0.5, category: "temporal", subcategory: "vague", note: "Asserts that a time exists without constraining it; establishes an expectation of eventual action and nothing more." },
  { pattern: /\bat some point\b/i, weight: 0.5, category: "temporal", subcategory: "vague", note: "Existential time reference with no bound; the weakest positive deadline signal in the ladder." },
  { pattern: /\beventually\b/i, weight: 0.5, category: "temporal", subcategory: "vague", note: "Asserts eventual completion; implies the task is not forgotten, which is a real if minimal force signal." },
  { pattern: /\bdown the (line|road|track)\b/i, weight: 0.5, category: "temporal", subcategory: "vague", note: "Idiomatic future deferral; positions the task as real but unscheduled." },
  { pattern: /\bin due course\b/i, weight: 0.5, category: "temporal", subcategory: "vague", note: "Formal-register vague deadline; common in UK and legal correspondence." },
  { pattern: /\bbefore (too|much) long\b/i, weight: 0.5, category: "temporal", subcategory: "vague", note: "Negatively bounded but unquantified; asserts a limit without naming it." },
  { pattern: /\bin the (near|nearish) (future|term)\b/i, weight: 0.5, category: "temporal", subcategory: "vague", note: "Corporate-register vague horizon; more committed than *eventually*, less than *this week*." },
  { pattern: /\bat some stage\b/i, weight: 0.5, category: "temporal", subcategory: "vague", note: "Variant existential time reference; distinct string, same function." },
  { pattern: /\bafter the (dust settles|crunch|launch madness)\b/i, weight: 0.5, category: "temporal", subcategory: "vague", note: "Idiomatic post-event deferral with no resolvable event date." },
  { pattern: /\bat some point (this|next) (month|quarter)\b/i, weight: 0.5, category: "temporal", subcategory: "vague", note: "**Uncertain** — has a nominal bound, so it arguably belongs at `relative`; kept vague because month- and quarter-scale bounds exert almost no near-term pressure." },
];
```

### Rung 2 — `relative` (weight 1.5)

```ts
export const TEMPORAL_RELATIVE: LexEntry[] = [
  { pattern: /\bthis week\b/i, weight: 1.5, category: "temporal", subcategory: "relative", note: "Bounds the deadline to a period with a definite end; the hearer can compute remaining time, which is what separates relative from vague." },
  { pattern: /\bnext week\b/i, weight: 1.5, category: "temporal", subcategory: "relative", note: "Bounded but further out; same computability, lower proximity — proximity is handled by the bonus function, not the rung." },
  { pattern: /\bsoon\b/i, weight: 1.5, category: "temporal", subcategory: "relative", note: "Asserts near-term action without a bound; **uncertain** placement — it lacks computability but carries clear urgency, so I ranked it on force rather than precision." },
  { pattern: /\bshortly\b/i, weight: 1.5, category: "temporal", subcategory: "relative", note: "Formal-register near-term marker; functionally identical to *soon*." },
  { pattern: /\bin the next (few|couple of) (days|hours)\b/i, weight: 1.5, category: "temporal", subcategory: "relative", note: "Explicit bounded window with a stated unit; among the most computable relative forms." },
  { pattern: /\bwithin (\d+|a few|two|three) (days|hours|weeks)\b/i, weight: 1.5, category: "temporal", subcategory: "relative", note: "Quantified duration bound; the numeral makes the constraint checkable." },
  { pattern: /\bby the end of (the )?(week|sprint|month)\b/i, weight: 1.5, category: "temporal", subcategory: "relative", note: "Period-terminal deadline; resolvable to a date only if the period boundary is known, hence relative rather than named-day." },
  { pattern: /\bthis sprint\b/i, weight: 1.5, category: "temporal", subcategory: "relative", note: "Engineering-register period bound; organizationally definite even though the calendar date is implicit." },
  { pattern: /\bbefore (the )?(standup|retro|sync|review|demo)\b/i, weight: 1.5, category: "temporal", subcategory: "relative", note: "Event-anchored deadline where the event is recurring and scheduled; resolvable in principle, which is why it clears `vague`." },
  { pattern: /\bahead of (the )?(meeting|call|session)\b/i, weight: 1.5, category: "temporal", subcategory: "relative", note: "Event-anchored precedence deadline; the anchor supplies a real constraint." },
  { pattern: /\bin the next day or (two|so)\b/i, weight: 1.5, category: "temporal", subcategory: "relative", note: "Approximate bounded window; the approximation keeps it below named-day precision." },
  { pattern: /\bover the next (day|couple of days)\b/i, weight: 1.5, category: "temporal", subcategory: "relative", note: "Durative window framing; same computability as the above." },
  { pattern: /\bthis (morning|afternoon|evening)\b/i, weight: 1.5, category: "temporal", subcategory: "relative", note: "Same-day period bound; **uncertain** — its proximity makes it feel closer to `immediate`, and the proximity bonus will largely correct for this." },
  { pattern: /\bbefore (the )?weekend\b/i, weight: 1.5, category: "temporal", subcategory: "relative", note: "Week-terminal deadline expressed by boundary event; resolvable relative to the message timestamp." },
  { pattern: /\bearly next week\b/i, weight: 1.5, category: "temporal", subcategory: "relative", note: "Partially specified window; more constrained than *next week*, less than a named day." },
  { pattern: /\bin a (couple|few) of hours\b/i, weight: 1.5, category: "temporal", subcategory: "relative", note: "Sub-day bounded window; ranked by precision rather than proximity, with the bonus doing the urgency work." },
];
```

### Rung 3 — `named_day` (weight 3.0)

```ts
export const TEMPORAL_NAMED_DAY: LexEntry[] = [
  { pattern: /\bby (mon|tues|wednes|thurs|fri|satur|sun)day\b/i, weight: 3.0, category: "temporal", subcategory: "named_day", note: "Explicit weekday deadline with a terminal preposition; resolves to a single date, which is a step change in accountability over any window." },
  { pattern: /\bon (mon|tues|wednes|thurs|fri|satur|sun)day\b/i, weight: 3.0, category: "temporal", subcategory: "named_day", note: "Weekday with locative preposition; slightly weaker than *by* since it names an occasion rather than a limit." },
  { pattern: /\b(mon|tues|wednes|thurs|fri)day (at the latest|latest)\b/i, weight: 3.0, category: "temporal", subcategory: "named_day", note: "Weekday with an explicit terminal qualifier; unambiguously a limit rather than a target." },
  { pattern: /\bend of (the )?week\b/i, weight: 3.0, category: "temporal", subcategory: "named_day", note: "Resolves to a specific day given a known work calendar; ranked above `relative` because the resolution is deterministic." },
  { pattern: /\bEOW\b/, weight: 3.0, category: "temporal", subcategory: "named_day", note: "Abbreviated end-of-week; identical semantics, high frequency in chat, and must be whitelisted against the all-caps upgrader." },
  { pattern: /\btomorrow\b/i, weight: 3.0, category: "temporal", subcategory: "named_day", note: "Deictic day reference resolving to a single date from the message timestamp; day-precise, hence this rung." },
  { pattern: /\bday after tomorrow\b/i, weight: 3.0, category: "temporal", subcategory: "named_day", note: "Two-step deictic day reference; equally resolvable, marginally less proximate." },
  { pattern: /\bby the (\d{1,2})(st|nd|rd|th)\b/i, weight: 3.0, category: "temporal", subcategory: "named_day", note: "Ordinal date without a month; resolves against the current month, day-precise." },
  { pattern: /\bon the (\d{1,2})(st|nd|rd|th)\b/i, weight: 3.0, category: "temporal", subcategory: "named_day", note: "Locative ordinal date; names an occasion rather than a limit, same precision." },
  { pattern: /\bmonday morning\b/i, weight: 3.0, category: "temporal", subcategory: "named_day", note: "Day plus period; **uncertain** — it carries partial time-of-day information and could arguably sit at `date_time`, but a period is not a clock time." },
  // Weekday-qualified EOD/COB is handled in the date_time parser rule below; do not also score it here.
  { pattern: /\bbefore (mon|tues|wednes|thurs|fri)day\b/i, weight: 3.0, category: "temporal", subcategory: "named_day", note: "Precedence deadline against a named day; strictly a limit, so it is at the top of this rung's force range." },
  { pattern: /\bby (next|this) (mon|tues|wednes|thurs|fri)day\b/i, weight: 3.0, category: "temporal", subcategory: "named_day", note: "Disambiguated weekday deadline; the determiner removes the week-ambiguity that bare weekday names carry." },
  { pattern: /\b(this|next) (monday|tuesday|wednesday|thursday|friday)\b/i, weight: 3.0, category: "temporal", subcategory: "named_day", note: "Determiner-qualified weekday without a preposition; day-precise, occasion-framed." },
  { pattern: /\bend of (the )?(month|quarter)\b/i, weight: 3.0, category: "temporal", subcategory: "named_day", note: "Period-terminal date that resolves deterministically; the long horizon is handled by the proximity bonus, not the rung." },
  { pattern: /\bdeadline is (mon|tues|wednes|thurs|fri)day\b/i, weight: 3.0, category: "temporal", subcategory: "named_day", note: "Explicit deadline nominal plus named day; the metalinguistic label makes the constraint maximally unambiguous." },
];
```

### Rung 4 — `date_time` (weight 4.0)

```ts
export const TEMPORAL_DATE_TIME: LexEntry[] = [
  { pattern: /\b(?:mon|tues|wednes|thurs|fri|satur|sun)day (?:EOD|COB)\b/i, weight: 4.0, category: "temporal", subcategory: "date_time", note: "Weekday-qualified business close resolves to a specific day boundary; unlike bare EOD/COB it must not be treated as same-day immediate." },
  { pattern: /\b(mon|tues|wednes|thurs|fri|satur|sun)day at \d{1,2}(:\d{2})?\s?(am|pm)?\b/i, weight: 4.0, category: "temporal", subcategory: "date_time", note: "Weekday plus clock time; a checkable instant, which is the highest form of deadline specificity short of immediacy." },
  { pattern: /\bby \d{1,2}(:\d{2})?\s?(am|pm)\b/i, weight: 4.0, category: "temporal", subcategory: "date_time", note: "Terminal preposition plus clock time; unambiguous limit at instant precision." },
  { pattern: /\bat \d{1,2}(:\d{2})\s?(am|pm)?\b/i, weight: 4.0, category: "temporal", subcategory: "date_time", note: "Clock time with locative preposition; names an instant, framed as occasion rather than limit." },
  { pattern: /\bby the \d{1,2}(st|nd|rd|th) of \w+\b/i, weight: 4.0, category: "temporal", subcategory: "date_time", note: "Full date with month; instant-precise at day granularity with no calendar ambiguity." },
  { pattern: /\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/, weight: 4.0, category: "temporal", subcategory: "date_time", note: "Numeric date; must be locale-disambiguated at parse time, and the analysis MUST record which convention was assumed." },
  { pattern: /\b\d{4}-\d{2}-\d{2}\b/, weight: 4.0, category: "temporal", subcategory: "date_time", note: "ISO date; unambiguous by construction and the preferred internal representation." },
  { pattern: /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* \d{1,2}\b/i, weight: 4.0, category: "temporal", subcategory: "date_time", note: "Month-name plus day; standard in email and unambiguous across locales." },
  { pattern: /\bbefore \d{1,2}\s?(am|pm)\b/i, weight: 4.0, category: "temporal", subcategory: "date_time", note: "Precedence deadline at clock precision; strictly a limit." },
  { pattern: /\bno later than \d{1,2}(:\d{2})?\s?(am|pm)?\b/i, weight: 4.0, category: "temporal", subcategory: "date_time", note: "Explicit maximality operator plus clock time; leaves no interpretive latitude at all." },
  { pattern: /\bdue (on|by) \w+ \d{1,2}\b/i, weight: 4.0, category: "temporal", subcategory: "date_time", note: "Deadline nominal plus date; the *due* label makes the constraint metalinguistically explicit." },
  { pattern: /\b\d{1,2}(:\d{2})?\s?(am|pm) (on )?(mon|tues|wednes|thurs|fri)day\b/i, weight: 4.0, category: "temporal", subcategory: "date_time", note: "Time-first ordering of clock plus weekday; same precision, distinct surface form." },
  { pattern: /\bstart of (play|business) (mon|tues|wednes|thurs|fri)day\b/i, weight: 4.0, category: "temporal", subcategory: "date_time", note: "Business-convention instant plus named day; resolves to a specific hour under standard office norms." },
  { pattern: /\bby (\d{1,2})(st|nd|rd|th) close\b/i, weight: 4.0, category: "temporal", subcategory: "date_time", note: "Ordinal date plus business-close convention; instant-precise under a known calendar." },
  { pattern: /\b(before|by) the \d{1,2}(am|pm) (cutoff|cut[- ]off)\b/i, weight: 4.0, category: "temporal", subcategory: "date_time", note: "Names an institutional cutoff at clock precision; the cutoff framing implies a hard consequence for missing it." },
  { pattern: /\b\d{1,2}(:\d{2})?\s?(am|pm) (sharp|latest)\b/i, weight: 4.0, category: "temporal", subcategory: "date_time", note: "Clock time with an emphatic precision qualifier; the qualifier forecloses the usual tolerance around stated times." },
  { pattern: /\bcalendar invite for \w+ \d{1,2}\b/i, weight: 4.0, category: "temporal", subcategory: "date_time", note: "Deadline instantiated as a scheduled artifact; the invite makes the constraint externally visible, which raises force further." },
];
```

### Rung 5 — `immediate` (weight 5.0)

```ts
export const TEMPORAL_IMMEDIATE: LexEntry[] = [
  { pattern: /\bwithin (?:[1-9]|[1-5]\d) minutes?\b/i, weight: 5.0, category: "temporal", subcategory: "immediate", note: "Explicit sub-hour bound from 1–59 minutes; this covers natural forms such as `within 20 minutes` without hard-coding one duration." },
  { pattern: /\bASAP\b/i, weight: 5.0, category: "temporal", subcategory: "immediate", note: "Maximal urgency with no upper bound on priority; assigned here rather than to upgraders per §0.3." },
  { pattern: /\bby noon\b/i, weight: 5.0, category: "temporal", subcategory: "immediate", note: "Same-day mid-day limit; sub-day precision plus same-day scope puts it on the top rung." },
  { pattern: /\bnow\b/i, weight: 5.0, category: "temporal", subcategory: "immediate", note: "Zero-latency demand; leaves no interval in which the hearer can schedule the task." },
  { pattern: /\bright (now|away)\b/i, weight: 5.0, category: "temporal", subcategory: "immediate", note: "Intensified immediacy; explicitly forecloses even brief deferral." },
  { pattern: /\bimmediately\b/i, weight: 5.0, category: "temporal", subcategory: "immediate", note: "Formal-register zero-latency adverb; standard in incident and security communication." },
  { pattern: /\bfirst thing (tomorrow|monday|in the morning)\b/i, weight: 5.0, category: "temporal", subcategory: "immediate", note: "Next-available-slot deadline; functionally immediate because it claims the hearer's first uncommitted time." },
  { pattern: /\bin the next (hour|30 minutes|half hour)\b/i, weight: 5.0, category: "temporal", subcategory: "immediate", note: "Sub-hour window; short enough that it preempts whatever the hearer is currently doing." },
  { pattern: /\bbefore you (log off|finish|clock out|head out)\b/i, weight: 5.0, category: "temporal", subcategory: "immediate", note: "Same-day deadline anchored to the hearer's own schedule; unusually binding because the anchor is under their control." },
  { pattern: /\bwithin the hour\b/i, weight: 5.0, category: "temporal", subcategory: "immediate", note: "Formal sub-hour bound; identical to the colloquial variant at higher register." },
  { pattern: /\bneeded (yesterday|an hour ago)\b/i, weight: 5.0, category: "temporal", subcategory: "already_past", note: "Past-due framing; resolve the stated past point and let the overdue branch of `proximityBonus` apply." },
  { pattern: /\b(was|were) due (yesterday|(?:mon|tues|wednes|thurs|fri|satur|sun)day)\b/i, weight: 5.0, category: "temporal", subcategory: "already_past", note: "Explicit missed deadline. Resolve to the most recent matching past date, never a future occurrence." },
  { pattern: /\bdue yesterday\b/i, weight: 5.0, category: "temporal", subcategory: "already_past", note: "Compact overdue form; same semantics as `was due yesterday`." },
  { pattern: /\balready overdue\b/i, weight: 5.0, category: "temporal", subcategory: "already_past", note: "Explicitly states that the deadline has passed even if the original date is not recoverable; maximum rung, unresolved timestamp allowed." },
  { pattern: /\boverdue since\s+((?:mon|tues|wednes|thurs|fri|satur|sun)day|\w+\s+\d{1,2})\b/i, weight: 5.0, category: "temporal", subcategory: "already_past", note: "Names the start of the overdue interval; resolve to the stated past date." },
  { pattern: /\bwas supposed to be (in|done|sent|submitted) (yesterday|(?:mon|tues|wednes|thurs|fri|satur|sun)day)\b/i, weight: 5.0, category: "temporal", subcategory: "already_past", note: "Conventional missed-deadline construction; the obligation wording is not the force evidence—the matched evidence event is the past time anchor." },
];
```

### Dynamic `EOD` / `COB` resolution

Bare `EOD` / `COB` (including `EOD today`) is parsed as the business-day-end instant supplied in config and treated as same-day immediate only when no explicit future weekday/date modifies it. A compound such as `Friday EOD` is parsed at the `date_time` rung for that Friday. This prevents a future `Friday EOD` from being misread as an immediate same-day deadline merely because it contains the token `EOD`.

### Dynamic `today` resolution

Bare `today` is **not a static lexicon entry** in v1.1. It is parsed as a same-calendar-day deadline using only `messageTimestamp` and a deterministic business-day convention supplied in config. The raw rung is chosen from remaining time:

- more than 6 hours remaining → `named_day` raw 3.0
- 2–6 hours remaining → `date_time` raw 4.0
- under 2 hours remaining → `immediate` raw 5.0

If no business-day end convention is supplied, resolve `today` to local 23:59 from the explicit timestamp offset and set `assumed: true`. The UI must expose that assumption.

This dynamic rule fixes the old error where `today` at 9:00 and `today` at 16:55 received the same base pressure.

### `proximityBonus`

```ts
export interface ParsedDeadline {
  rung: TemporalRung;
  /** Resolved instant, or null when the rung is `none` / `vague` / otherwise unresolvable. */
  resolvedAt: string | null;   // ISO 8601 with offset
  /** True when resolution required assuming a calendar convention (e.g. numeric dates). */
  assumed: boolean;
  span: Span;
}

/**
 * Additive bonus applied to the temporal component AFTER rung scaling.
 * Returns 0 when the deadline is unresolvable — proximity is undefined without an instant.
 * Deterministic: uses only the two arguments, never the wall clock (`SPEC.md` §3).
 */
export function proximityBonus(
  deadline: ParsedDeadline,
  messageTimestamp: string
): number;
```

**Curve.** Exponential decay in hours-to-deadline:

```
h = (resolvedAt − messageTimestamp) in hours

if resolvedAt === null           → 0
if h <= 0  (already past due)    → MAX
if h >= HORIZON (336h / 14 days) → 0
otherwise                        → MAX * exp(-h / TAU)

MAX = 1.5,  TAU = 48,  HORIZON = 336
```

Why exponential rather than linear: the perceived pressure of a deadline is not proportional to remaining time. The difference between 2 hours and 26 hours is enormous; the difference between 10 days and 11 days is nearly nothing. An exponential with τ = 48h puts the steep region inside the two-day window where workplace deadlines actually bite, and flattens beyond it. Linear decay would over-weight distant deadlines and compress the near-term distinctions that matter most.

Why past-due clamps to `MAX` rather than exceeding it: an overdue deadline is maximally proximate, but letting it grow unbounded would make force a function of how long a thread has been stale, which belongs to repetition/escalation (`SPEC.md` §11), not proximity. Keeping them separate preserves the additivity of the evidence array.

**Emitted as its own evidence entry**, subcategory `temporal.proximity`, with the span of the deadline expression and `note` generated as `"deadline resolves to {resolvedAt}, {h}h after this message"`. If `assumed` is true, the UI MUST surface the assumed convention.

---

## 5. `consequence.ts` — what happens if this is ignored

**Force only. These patterns MUST NEVER be evaluated by the surface scorer** (`SPEC.md` §10 masking/partition). Raw weights 1.5–3.0. A broad sanction word does not count when it is merely the requested action inside `requestClauseSpan`; see the force-attachment gate below.

**Force-attachment gate.** Sanction and consequence entries score only when they describe an outcome of non-compliance, not when the matched word is itself the requested action. A span inside `requestClauseSpan` containing `escalate`, `reopen`, `loop in`, etc. is ignored unless a separately segmented consequence relation licenses it. This prevents `Could you escalate this issue?` from gaining force merely because the requested verb is `escalate`.

```ts
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
```

**Entry count is generated by the build audit; do not hard-code this number in scoring logic.**

---

## 6. `dependency.ts` — social and structural pressure

**Force only.** Raw weights 1.0–2.5.

```ts
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
```

**Entry count is generated by the build audit; do not hard-code this number in scoring logic.**

---

## 7. v1.1 reconciliation notes

The earlier self-review identified several contestable entries. V1.1 resolves the highest-risk ones rather than carrying them forward as known contradictions:

- `no rush` is reduced to raw 2.0 and is surface-only wherever it occurs.
- single `!` is not scored.
- `critical`, `urgent`, and `high priority` remain surface-only lexical uptoners in v1.1. They intensify the wording but do not by themselves establish a deadline or downstream consequence.
- `today` is dynamically resolved from `messageTimestamp`; it is no longer a static maximum-rung entry.
- `needs doing / needs a look` move to L4 agentless obligation; `needs eyes` is excluded.
- `no mad rush but`, availability-conditioned timing, `drop everything`, and priority-ordering phrases are removed from the force temporal inventory.
- blockage language has one canonical force home: dependency.
- force evidence is deduplicated by span and underlying event.
- broad ambiguous modifiers `simply`, `I'm sure`, and `I'll be honest` are removed rather than context-guessed.
- bare EOD/COB is dynamically resolved so future `Friday EOD` cannot be misread as immediate.
- consequence/sanction words are gated so a requested action such as `escalate this` does not become its own force evidence.
- lexical follow-up and verified thread escalation share a single capped repetition/escalation component.

Remaining uncertain items are marked inline. In v1.1, uncertainty is a reason to suppress, context-gate, or assign a conservative weight—not to create a second competing rule.
