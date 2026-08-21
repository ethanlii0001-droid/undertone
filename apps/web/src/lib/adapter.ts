/**
 * Adapts the editor's minimal {sender, recipient, text} rows into a full
 * engine `Thread`. The engine (packages/engine, CLAUDE.md rule 1) is never
 * allowed to read the wall clock itself, so this is the one place a
 * deterministic, caller-supplied timestamp sequence is manufactured: a fixed
 * anchor instant plus a fixed per-message offset, never `Date.now()`.
 */
import type { Message, Thread } from "@undertone/engine/src/types";
import type { EditorMessage } from "./types";

const THREAD_ID = "ui-thread";

/** Fixed anchor instant — arbitrary but constant, never the wall clock. */
const BASE_TIMESTAMP_MS = Date.parse("2026-01-05T09:00:00-05:00");
const MESSAGE_INTERVAL_MS = 60 * 60 * 1000;

let idCounter = 0;

/** Stable, monotonically increasing id — not `Math.random()`, not a UUID. */
export function nextMessageId(): string {
  idCounter += 1;
  return `msg-${idCounter}`;
}

/** Deterministic, strictly increasing timestamp for the message at `index`. */
export function timestampForIndex(index: number): string {
  return new Date(BASE_TIMESTAMP_MS + index * MESSAGE_INTERVAL_MS).toISOString();
}

export function buildThread(editorMessages: EditorMessage[]): Thread {
  const messages: Message[] = editorMessages.map((row, index) => {
    const sender = row.sender.trim() || `Sender ${index + 1}`;
    const recipient = row.recipient.trim();
    return {
      id: row.id,
      threadId: THREAD_ID,
      senderId: sender,
      recipientIds: recipient ? [recipient] : [],
      mentionedIds: [],
      timestamp: timestampForIndex(index),
      text: row.text,
    };
  });
  return { id: THREAD_ID, messages };
}
