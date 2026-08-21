import type { ThreadAnalysis } from "@undertone/engine/src/types";
import type { EditorMessage } from "@/lib/types";
import { MessageResult } from "./MessageResult";
import { DivergenceChart } from "./DivergenceChart";

interface ResultsViewProps {
  messages: EditorMessage[];
  analysis: ThreadAnalysis;
}

export function ResultsView({ messages, analysis }: ResultsViewProps) {
  const scoredCount = analysis.messages.filter((m) => m.surface !== null).length;

  return (
    <section aria-labelledby="results-heading" className="mx-auto w-full max-w-2xl mt-10">
      <h2 id="results-heading" tabIndex={-1} className="font-serif-display text-lg mb-4">
        Results
      </h2>

      {scoredCount >= 2 && (
        <div
          className="border rounded-sm p-4 mb-6"
          style={{ borderColor: "var(--hairline)", background: "var(--paper-raised)" }}
        >
          <DivergenceChart analyses={analysis.messages} />
        </div>
      )}

      <div className="flex flex-col gap-4">
        {analysis.messages.map((messageAnalysis, index) => {
          const editorMessage = messages[index];
          if (!editorMessage) return null;
          return (
            <MessageResult
              key={messageAnalysis.messageId}
              message={editorMessage}
              analysis={messageAnalysis}
              index={index}
            />
          );
        })}
      </div>
    </section>
  );
}
