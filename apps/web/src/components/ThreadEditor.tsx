"use client";

import type { EditorMessage } from "@/lib/types";
import { SAMPLE_THREADS } from "@/lib/samples";

interface ThreadEditorProps {
  messages: EditorMessage[];
  onChange: (id: string, field: "sender" | "recipient" | "text", value: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onLoadSample: (sampleId: string) => void;
  onAnalyze: () => void;
  canAnalyze: boolean;
}

export function ThreadEditor({
  messages,
  onChange,
  onAdd,
  onRemove,
  onLoadSample,
  onAnalyze,
  canAnalyze,
}: ThreadEditorProps) {
  return (
    <section aria-labelledby="editor-heading" className="mx-auto w-full max-w-2xl">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
        <h2 id="editor-heading" className="font-serif-display text-lg">
          Thread
        </h2>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_THREADS.map((sample) => (
            <button
              key={sample.id}
              type="button"
              onClick={() => onLoadSample(sample.id)}
              title={sample.description}
              className="transition-editorial text-xs uppercase tracking-wide px-2.5 py-1.5 border rounded-sm"
              style={{ borderColor: "var(--hairline-strong)", color: "var(--ink-muted)" }}
            >
              {sample.label}
            </button>
          ))}
        </div>
      </div>

      <ol className="flex flex-col gap-3">
        {messages.map((message, index) => (
          <li
            key={message.id}
            className="border rounded-sm p-3"
            style={{ borderColor: "var(--hairline)", background: "var(--paper-raised)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>
                Message {index + 1}
              </span>
              {messages.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemove(message.id)}
                  aria-label={`Remove message ${index + 1}`}
                  className="transition-editorial text-xs px-2 py-1 -my-1 -mr-1 rounded-sm border border-transparent hover:border-current"
                  style={{ color: "var(--ink-muted)" }}
                >
                  Remove
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 mb-2">
              <label className="flex-1 flex flex-col gap-0.5 text-xs" style={{ color: "var(--ink-muted)" }}>
                Sender
                <input
                  type="text"
                  value={message.sender}
                  onChange={(e) => onChange(message.id, "sender", e.target.value)}
                  placeholder="e.g. Alice"
                  className="border rounded-sm px-2 py-1 text-sm bg-transparent"
                  style={{ borderColor: "var(--hairline-strong)", color: "var(--ink)" }}
                />
              </label>
              <label className="flex-1 flex flex-col gap-0.5 text-xs" style={{ color: "var(--ink-muted)" }}>
                Recipient
                <input
                  type="text"
                  value={message.recipient}
                  onChange={(e) => onChange(message.id, "recipient", e.target.value)}
                  placeholder="e.g. Bob (blank = unresolved)"
                  className="border rounded-sm px-2 py-1 text-sm bg-transparent"
                  style={{ borderColor: "var(--hairline-strong)", color: "var(--ink)" }}
                />
              </label>
            </div>

            <label className="flex flex-col gap-0.5 text-xs" style={{ color: "var(--ink-muted)" }}>
              Message text
              <textarea
                value={message.text}
                onChange={(e) => onChange(message.id, "text", e.target.value)}
                placeholder="Type the message as it was sent…"
                rows={2}
                className="border rounded-sm px-2 py-1.5 text-sm bg-transparent resize-y font-sans"
                style={{ borderColor: "var(--hairline-strong)", color: "var(--ink)" }}
              />
            </label>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-3 mt-3">
        <button
          type="button"
          onClick={onAdd}
          className="transition-editorial text-sm px-3 py-2 border rounded-sm"
          style={{ borderColor: "var(--hairline-strong)", color: "var(--ink-muted)" }}
        >
          + Add message
        </button>

        <button
          type="button"
          onClick={onAnalyze}
          disabled={!canAnalyze}
          className="transition-editorial text-sm px-4 py-2 rounded-sm font-medium ml-auto disabled:opacity-40"
          style={{ background: "var(--ink)", color: "var(--paper)" }}
        >
          Analyze
        </button>
      </div>
    </section>
  );
}
