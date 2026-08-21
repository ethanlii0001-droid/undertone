"use client";

import { useEffect, useState } from "react";
import { score } from "@undertone/engine";
import type { MessageAnalysis } from "@undertone/engine/src/types";
import { buildComposeThread, nowIsoWithOffset } from "@/lib/compose";
import { MessageResult } from "@/components/MessageResult";

const DEBOUNCE_MS = 150;

const NOT_DETECTED_YET = "No reproducible workplace request is detected yet.";
const ADD_RECIPIENT = "Add a recipient to see the analysis.";

export default function ComposePage() {
  const [sender, setSender] = useState("");
  const [recipient, setRecipient] = useState("");
  const [text, setText] = useState("");
  const [analysis, setAnalysis] = useState<MessageAnalysis | null>(null);

  const hasText = text.trim().length > 0;
  const hasRecipient = recipient.trim().length > 0;
  const canScore = hasText && hasRecipient;

  // Prompt 10 §8: no Analyze button — live analysis follows the input after
  // a short debounce, using the real engine (score(Thread)), never a
  // separate compose-only heuristic. Each field's onChange below also clears
  // `analysis` synchronously (Prompt 10 final cleanup #2), so during the
  // ~150ms window between a keystroke and this debounce firing, the old
  // result — whose Evidence offsets describe the previous text — is never
  // rendered; the "not detected yet" placeholder shows instead until a fresh
  // result matching the current input arrives.
  useEffect(() => {
    if (!canScore) return;
    const handle = setTimeout(() => {
      // Prompt 10 §9: the timestamp is regenerated here, at analysis time,
      // from the current local moment — never inside the engine.
      const timestamp = nowIsoWithOffset();
      const thread = buildComposeThread(sender, recipient, text, timestamp);
      const result = score(thread);
      setAnalysis(result.messages[0] ?? null);
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [sender, recipient, text, canScore]);

  const composeMessage = { id: "compose-message", sender, recipient, text };

  let body: React.ReactNode;
  if (!hasText) {
    body = <QuietNote>{NOT_DETECTED_YET}</QuietNote>;
  } else if (!hasRecipient) {
    body = <QuietNote>{ADD_RECIPIENT}</QuietNote>;
  } else if (!analysis || analysis.suppressed) {
    body = <QuietNote>{NOT_DETECTED_YET}</QuietNote>;
  } else {
    body = <MessageResult message={composeMessage} analysis={analysis} index={0} />;
  }

  return (
    <div className="flex flex-col flex-1">
      <div className="mx-auto w-full max-w-[1180px] pt-8 pb-6 sm:pt-12 sm:pb-8">
        <h1 className="font-serif-display text-2xl sm:text-3xl tracking-tight">Compose a message</h1>
        <p className="text-sm sm:text-base leading-relaxed mt-2 max-w-prose" style={{ color: "var(--ink-muted)" }}>
          See how a workplace request may be read before you send it.
        </p>
      </div>

      {/* Prompt 10B §4: two columns at desktop — form and live analysis both
          visible at once — collapsing to the original stacked order below
          `lg`, where each column keeps its previous centered max-w-2xl. */}
      <div className="mx-auto w-full max-w-[1100px] lg:grid lg:grid-cols-2 lg:gap-10 lg:items-start">
        <section
          aria-labelledby="compose-heading"
          className="max-w-2xl mx-auto lg:max-w-none lg:mx-0"
        >
          <h2 id="compose-heading" className="sr-only">
            Message
          </h2>
          <div
            className="border rounded-sm p-3"
            style={{ borderColor: "var(--hairline)", background: "var(--paper-raised)" }}
          >
            <div className="flex flex-col sm:flex-row gap-2 mb-2">
              <label className="flex-1 flex flex-col gap-0.5 text-xs" style={{ color: "var(--ink-muted)" }}>
                Sender
                <input
                  type="text"
                  value={sender}
                  onChange={(e) => {
                    setSender(e.target.value);
                    setAnalysis(null);
                  }}
                  placeholder="e.g. Alice"
                  className="border rounded-sm px-2 py-1 text-sm bg-transparent"
                  style={{ borderColor: "var(--hairline-strong)", color: "var(--ink)" }}
                />
              </label>
              <label className="flex-1 flex flex-col gap-0.5 text-xs" style={{ color: "var(--ink-muted)" }}>
                Recipient
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => {
                    setRecipient(e.target.value);
                    setAnalysis(null);
                  }}
                  placeholder="e.g. Bob"
                  className="border rounded-sm px-2 py-1 text-sm bg-transparent"
                  style={{ borderColor: "var(--hairline-strong)", color: "var(--ink)" }}
                />
              </label>
            </div>

            <label className="flex flex-col gap-0.5 text-xs" style={{ color: "var(--ink-muted)" }}>
              Message
              <textarea
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setAnalysis(null);
                }}
                placeholder="Type the message you're about to send…"
                rows={4}
                className="border rounded-sm px-2 py-1.5 text-sm bg-transparent resize-y font-sans"
                style={{ borderColor: "var(--hairline-strong)", color: "var(--ink)" }}
              />
            </label>
          </div>
        </section>

        <section
          aria-labelledby="compose-results-heading"
          className="max-w-2xl mx-auto lg:max-w-none lg:mx-0 mt-8 lg:mt-0 lg:sticky lg:top-8"
        >
          <h2 id="compose-results-heading" className="font-serif-display text-lg mb-4">
            Analysis
          </h2>
          {body}
        </section>
      </div>
    </div>
  );
}

function QuietNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm italic" style={{ color: "var(--ink-faint)" }}>
      {children}
    </p>
  );
}
