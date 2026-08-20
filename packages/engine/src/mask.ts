/**
 * Builds the offset-preserving MaskedMessage consumed by the force scorer,
 * per SPEC.md §10 (Masking and partition invariant). Masks modal verbs and
 * grammatical mood markers belonging to the head act, every span already
 * consumed as surface downgrader/upgrader evidence, and quoted/reporting
 * material suppressed by request detection.
 *
 * This is the mechanism that enforces the surface/force independence claim
 * (SPEC.md §5.1; CLAUDE.md rule 3): force scoring must never see raw
 * surface material, only the masked view this module produces. Per
 * CLAUDE.md rule 3, force may never receive the raw Message, HeadAct,
 * SurfaceScore, CCSARP level, strategy name, modal/mood information, or
 * surface modifier information — only this module sits at that boundary
 * and converts them into a MaskedMessage. This file does not import any
 * force lexicon (temporal.ts/consequence.ts/dependency.ts) — deciding what
 * counts as "surface material to mask" never requires knowing what force
 * patterns exist.
 */
import type { HeadAct, Message, MaskedMessage, Span, SurfaceScore } from "./types.js";

/**
 * Replaces every character in `[span.start, span.end)` with a space,
 * except structural line-break characters (`\n`, `\r`), which are left in
 * place so a later re-segmentation of maskedText (e.g. force/temporal.ts
 * re-running segmentSentences) still sees the same paragraph/sentence
 * boundaries segment.ts would find in the original text (SPEC.md §10:
 * "preserve exact string length... preserve structural line-break
 * characters"). Never deletes or inserts characters — length is invariant.
 */
function maskSpanInPlace(chars: string[], span: Span): void {
  for (let i = span.start; i < span.end && i < chars.length; i++) {
    if (chars[i] !== "\n" && chars[i] !== "\r") chars[i] = " ";
  }
}

/**
 * Finds fully-closed quoted regions (straight `"..."` or curly `“…”`) in
 * `text`, reproducibly identifying material SPEC.md §10 requires masking
 * as "quoted/reporting material suppressed by request detection" — the
 * same phenomenon headAct.ts's `isQuotedSpan` guards against for the head
 * act's own clause, generalized here to the whole message so a quoted
 * request or quoted deadline elsewhere in the message cannot leak into
 * force evidence as if the current speaker had said it. Deterministic,
 * single left-to-right scan; an unterminated opening quote masks nothing
 * (conservative — only genuinely closed quotations are masked).
 */
function findQuotedSpans(text: string): Span[] {
  const spans: Span[] = [];
  let straightStart = -1;
  let curlyStart = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (straightStart === -1) straightStart = i;
      else {
        spans.push({ start: straightStart, end: i + 1 });
        straightStart = -1;
      }
    } else if (ch === "“") {
      curlyStart = i;
    } else if (ch === "”" && curlyStart !== -1) {
      spans.push({ start: curlyStart, end: i + 1 });
      curlyStart = -1;
    }
  }
  return spans;
}

/**
 * Function words excluded from `requestSignature` (SPEC.md §11.4):
 * pronouns, modal/auxiliary verbs, articles/prepositions/conjunctions, and
 * a small set of request-framing verbs/adjectives ("asking", "like",
 * "mind", "chance", "sec"...) that realize CCSARP strategy rather than
 * naming the requested content. This is a hand-curated list sized for the
 * canonical fixtures (CLAUDE.md rule 8 / this file's own limitation note
 * below), not a POS tagger.
 */
const REQUEST_SIGNATURE_STOPWORDS: ReadonlySet<string> = new Set([
  "i", "you", "we", "they", "he", "she", "it", "me", "us", "them",
  "your", "my", "our", "their", "his", "her", "its", "d", "s", "m", "ll", "re", "ve", "t",
  "could", "would", "should", "can", "will", "might", "may", "must",
  "do", "does", "did", "done", "is", "are", "was", "were", "am", "be", "been", "being",
  "have", "has", "had",
  "the", "a", "an", "to", "of", "for", "in", "on", "at", "by", "with", "and", "or", "but",
  "if", "that", "this", "these", "those", "so", "not",
  "please", "just", "maybe", "really", "very", "also", "possibly", "perhaps", "kind", "sort",
  "kinda", "sorta", "ideally", "potentially", "totally", "actually",
  "let", "lets",
  "asking", "need", "needs", "needed", "want", "wants", "wanted", "like", "liked",
  "mind", "think", "thinks", "thought", "possible", "able", "chance", "sec", "second",
  "minute", "moment", "hey", "thanks", "thank", "sorry", "sure", "ok", "okay",
  // Prompt 6R-A Task 4A: "again" is an adverb, not a noun/main verb/proper noun (SPEC.md
  // §11.4's own definition of request content words), so it does not belong in the signature —
  // "Could you review the deck again?" must converge on the same core as the un-repeated form.
  "again",
]);

/**
 * Irregular inflected forms of request-action verbs that ordinary suffix
 * stripping (below) cannot recover — e.g. "sent" has no "-s"/"-ed"/"-ing"
 * suffix to strip at all. Kept to the smallest defensible set (Prompt
 * 6R-A Task 1A): only entries a canonical fixture or regression actually
 * needs, never a general irregular-verb table.
 */
const IRREGULAR_ACTION_VERBS: Readonly<Record<string, string>> = {
  sent: "send",
};

/**
 * The small, closed inventory of request-action verb base forms this
 * normalizer recognizes (Prompt 6R-A Task 1). A token only ever gets
 * rewritten when one of its regularly-inflected candidate forms lands
 * exactly on an entry here — nothing outside this set is ever touched, so
 * ordinary content nouns ("business", "analysis", "status", "address", ...)
 * pass through completely unchanged even though they also end in
 * "s"/"ed"/"ing"-shaped substrings.
 */
const ACTION_VERB_BASES: ReadonlySet<string> = new Set([
  "review",
  "send",
  "submit",
  "update",
  "fix",
  "confirm",
  "share",
  "upload",
  "attach",
]);

function stripSuffix(token: string, suffix: string): string | null {
  return token.length > suffix.length && token.endsWith(suffix) ? token.slice(0, -suffix.length) : null;
}

/** "submitt" -> "submit", "shopp" -> "shop": undoes a doubled final consonant left over after stripping "-ed"/"-ing" (e.g. "submitted" -> "submitt"). Only touches a genuinely doubled, non-vowel final letter. */
function undoDoubledFinalConsonant(word: string): string | null {
  if (word.length < 2) return null;
  const last = word[word.length - 1] as string;
  const secondLast = word[word.length - 2] as string;
  return last === secondLast && !"aeiou".includes(last) ? word.slice(0, -1) : null;
}

/**
 * Every regularly-inflected candidate base form `token` could reduce to,
 * cheapest/most-literal first: the token itself, then "-ing"/"-ed" with
 * both the bare stripped form and the silent-"e"-restored form ("updat"
 * -> "update") and the doubled-consonant-undone form ("submitt" ->
 * "submit"), then "-es", then "-s". Purely mechanical string surgery —
 * candidates that don't land in `ACTION_VERB_BASES` are simply discarded
 * by the caller, so generating a few wrong candidates here is harmless.
 */
function candidateBaseForms(token: string): string[] {
  const candidates = [token];
  for (const suffix of ["ing", "ed"]) {
    const stripped = stripSuffix(token, suffix);
    if (stripped) {
      candidates.push(stripped, `${stripped}e`);
      const undoubled = undoDoubledFinalConsonant(stripped);
      if (undoubled) candidates.push(undoubled);
    }
  }
  const es = stripSuffix(token, "es");
  if (es) candidates.push(es);
  const s = stripSuffix(token, "s");
  if (s) candidates.push(s);
  return candidates;
}

/**
 * Normalizes one content token toward its request-action base form when —
 * and only when — a regular or irregular inflection of it lands exactly
 * on `ACTION_VERB_BASES` (Prompt 6R-A Task 1). Anything else (ordinary
 * nouns, proper nouns, action verbs outside this small inventory) is
 * returned completely unchanged: this is deliberately not a general
 * stemmer, so it never risks turning a content noun into a mangled
 * fragment the way a universal suffix-stripping rule would.
 */
export function normalizeActionToken(token: string): string {
  const irregular = IRREGULAR_ACTION_VERBS[token];
  if (irregular) return irregular;
  for (const candidate of candidateBaseForms(token)) {
    if (ACTION_VERB_BASES.has(candidate)) return candidate;
  }
  return token;
}

/**
 * Deterministic, lowercased content-word extraction for `requestSignature`
 * (SPEC.md §11.4: "lowercased, lemmatized request content words... no
 * CCSARP strategy level or surface score" — modal/mood material removed).
 * Operates on the ORIGINAL head-act clause text, not the force-masked
 * text: `maskedText` blanks out the directness match span entirely (it IS
 * surface evidence), which would also delete a genuine main verb realized
 * by mood alone (`"Send the deck."` — "Send" is both the mood marker AND
 * the content verb). Since `HeadAct.verb`/`.object` are non-scoring
 * placeholder metadata (headAct.ts), this runs its own independent
 * stopword pass over the clause text instead of reusing either of those,
 * then applies `normalizeActionToken` to each surviving token.
 *
 * KNOWN LIMITATION (documented per this prompt's "narrowest deterministic
 * rule" instruction rather than inventing semantic inference): this is
 * deterministic, lightweight English normalization — a stopword filter
 * plus a small closed-inventory suffix/irregular-form normalizer for
 * common request-action verbs (review/send/submit/update/fix/confirm/
 * share/upload/attach and the single irregular "sent" -> "send") — NOT a
 * full morphological analyzer or parser. It will fail to normalize
 * uncommon irregular verbs or action verbs outside that small inventory,
 * and deliberately does not attempt to; that conservatism is intentional,
 * to avoid corrupting ordinary content nouns the way a universal stemmer
 * would. It is sufficient to make `"Send the deck."`, `"Could you send
 * the deck?"`, and `"I'd like you to send the deck."` converge on the
 * equivalent of `["send", "deck"]`, which is what SPEC.md §11.4's
 * same-request matching (Jaccard over content words) actually needs.
 */
function buildRequestSignature(text: string, requestClauseSpan: Span): readonly string[] {
  const clause = text.slice(requestClauseSpan.start, requestClauseSpan.end);
  const tokens = clause.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return tokens.filter((token) => !REQUEST_SIGNATURE_STOPWORDS.has(token)).map(normalizeActionToken);
}

/**
 * Deterministic empty structural span used by `buildContextMaskedMessage`
 * below for a message that carries no request at all — there is no head
 * act, so there is no request clause to point to (SPEC.md §10's
 * `requestClauseSpan` is a structural boundary, and an empty `[0, 0)` span
 * is the reproducible "no clause" value, never a guessed one).
 */
const EMPTY_REQUEST_CLAUSE_SPAN: Span = { start: 0, end: 0 };

/**
 * Builds the MaskedMessage the force scorer receives (SPEC.md §10). Masks
 * every surface Evidence span (the directness match — the head act's own
 * modal/mood realization — plus every non-absorbed downgrader/upgrader
 * span) and every reproducibly-identified quoted region, preserving exact
 * string length and all original UTF-16 offsets. `requestClauseSpan` is
 * `headAct.span` verbatim — already structural-only (just a `Span`, no
 * strategy/mood label attached).
 */
export function buildMaskedMessage(message: Message, headAct: HeadAct, surface: SurfaceScore): MaskedMessage {
  const chars = message.text.split("");
  const maskedSpans: Span[] = [];

  for (const evidence of surface.evidence) {
    maskSpanInPlace(chars, evidence.span);
    maskedSpans.push(evidence.span);
  }

  for (const quotedSpan of findQuotedSpans(message.text)) {
    maskSpanInPlace(chars, quotedSpan);
    maskedSpans.push(quotedSpan);
  }

  return {
    messageId: message.id,
    maskedText: chars.join(""),
    maskedSpans,
    requestClauseSpan: headAct.span,
    requestSignature: buildRequestSignature(message.text, headAct.span),
    timestamp: message.timestamp,
    senderId: message.senderId,
    recipientIds: [...message.recipientIds],
  };
}

/**
 * Builds a context-only MaskedMessage for a message that carries no
 * reproducible request of its own — a suppressed message (SPEC.md §6.1) or
 * a recipient reply like `"done"`/`"sent"` (SPEC.md §11.4's completion
 * signals). Needed because `force/escalation.ts`'s verified-restatement and
 * completion-signal logic (SPEC.md §11.4) must see every prior message in
 * the thread, not only prior requests — but the force scorer must never
 * receive a raw `Message` (CLAUDE.md rule 3), so this produces the same
 * `MaskedMessage` shape `buildMaskedMessage` does, without fabricating a
 * request:
 *
 * - `requestClauseSpan` is the deterministic empty `[0, 0)` span (there is
 *   no head act to point to) and `requestSignature` is `[]`, so this
 *   message can never satisfy `isSameRequest`'s Jaccard threshold and so
 *   can never itself count as a verified mention of anything.
 * - Reproducibly-closed quoted regions are still masked exactly as in
 *   `buildMaskedMessage`, so a quoted completion signal (`He said "done"`)
 *   is masked out and cannot be read by `containsCompletionSignal` as if
 *   the current speaker had said it.
 * - No surface Evidence exists for a non-request message (there is no
 *   HeadAct to score surface from), so only the quoted-region masking
 *   applies here — never surface-evidence-span masking.
 */
export function buildContextMaskedMessage(message: Message): MaskedMessage {
  const chars = message.text.split("");
  const maskedSpans: Span[] = [];

  for (const quotedSpan of findQuotedSpans(message.text)) {
    maskSpanInPlace(chars, quotedSpan);
    maskedSpans.push(quotedSpan);
  }

  return {
    messageId: message.id,
    maskedText: chars.join(""),
    maskedSpans,
    requestClauseSpan: EMPTY_REQUEST_CLAUSE_SPAN,
    requestSignature: [],
    timestamp: message.timestamp,
    senderId: message.senderId,
    recipientIds: [...message.recipientIds],
  };
}
