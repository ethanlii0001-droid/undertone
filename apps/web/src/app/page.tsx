"use client";

import { useEffect, useState } from "react";
import { score } from "@undertone/engine";
import type { ThreadAnalysis } from "@undertone/engine/src/types";
import type { EditorMessage } from "@/lib/types";
import { buildThread, nextMessageId } from "@/lib/adapter";
import { SAMPLE_THREADS } from "@/lib/samples";
import { Header } from "@/components/Header";
import { ThreadEditor } from "@/components/ThreadEditor";
import { ResultsView } from "@/components/ResultsView";
import { Footer } from "@/components/Footer";

function emptyMessage(): EditorMessage {
  return { id: nextMessageId(), sender: "", recipient: "", text: "" };
}

export default function Home() {
  const [messages, setMessages] = useState<EditorMessage[]>([emptyMessage()]);
  const [analysis, setAnalysis] = useState<ThreadAnalysis | null>(null);
  const [analyzedMessages, setAnalyzedMessages] = useState<EditorMessage[]>([]);

  const canAnalyze = messages.some((m) => m.text.trim().length > 0);

  // Prompt 9B §9: after a successful analysis, send focus to the Results
  // heading (and bring it into view) so a live demo doesn't require manual
  // scrolling to find the outcome of pressing Analyze. `analysis` is a
  // fresh object on every `score()` call, so this fires on every Analyze
  // click, including re-analyzing unchanged input.
  useEffect(() => {
    if (!analysis) return;
    const heading = document.getElementById("results-heading");
    if (!heading) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    heading.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
    heading.focus({ preventScroll: true });
  }, [analysis]);

  function updateMessage(id: string, field: "sender" | "recipient" | "text", value: string) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  }

  function addMessage() {
    setMessages((prev) => [...prev, emptyMessage()]);
  }

  function removeMessage(id: string) {
    setMessages((prev) => (prev.length > 1 ? prev.filter((m) => m.id !== id) : prev));
  }

  function loadSample(sampleId: string) {
    const sample = SAMPLE_THREADS.find((s) => s.id === sampleId);
    if (!sample) return;
    setMessages(sample.rows.map((row) => ({ id: nextMessageId(), ...row })));
    setAnalysis(null);
  }

  function analyze() {
    const nonEmpty = messages.filter((m) => m.text.trim().length > 0);
    const thread = buildThread(nonEmpty);
    setAnalysis(score(thread));
    setAnalyzedMessages(nonEmpty);
  }

  return (
    <div className="flex flex-col flex-1 px-4 sm:px-6">
      <Header />
      <main className="flex-1 flex flex-col">
        <ThreadEditor
          messages={messages}
          onChange={updateMessage}
          onAdd={addMessage}
          onRemove={removeMessage}
          onLoadSample={loadSample}
          onAnalyze={analyze}
          canAnalyze={canAnalyze}
        />

        {analysis && <ResultsView messages={analyzedMessages} analysis={analysis} />}
      </main>
      <Footer />
    </div>
  );
}
