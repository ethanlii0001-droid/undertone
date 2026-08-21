/**
 * Compose Mode's own timestamp + Thread construction (Prompt 10 §9). Unlike
 * the historical thread editor (adapter.ts's fixed anchor instant), a
 * composed message represents "about to be sent right now" — so dynamic
 * temporal expressions (`today`, `by 3pm`, `EOD`) must resolve against the
 * actual current moment. The engine itself is never allowed to read the wall
 * clock (CLAUDE.md rule 1); this file is the one place in the web layer that
 * reads it, producing an explicit ISO 8601 timestamp with a real UTC offset
 * that gets threaded through as ordinary `Message.timestamp` input.
 */
import type { Message, Thread } from "@undertone/engine/src/types";

const COMPOSE_THREAD_ID = "compose-thread";
const COMPOSE_MESSAGE_ID = "compose-message";

function pad(value: number, width = 2): string {
  return String(value).padStart(width, "0");
}

/**
 * Current local date/time as an ISO 8601 string with an explicit UTC offset
 * (never `Z`), read fresh on every call so re-analysis after a debounce
 * reflects the moment analysis actually ran, not when the page loaded.
 */
export function nowIsoWithOffset(): string {
  const now = new Date();
  const offsetMinutes = -now.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const offset = `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;

  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  return `${date}T${time}${offset}`;
}

/** Builds the single-message Thread Compose Mode scores, given a fresh timestamp from `nowIsoWithOffset`. */
export function buildComposeThread(sender: string, recipient: string, text: string, timestamp: string): Thread {
  const senderId = sender.trim() || "Sender";
  const recipientId = recipient.trim();
  const message: Message = {
    id: COMPOSE_MESSAGE_ID,
    threadId: COMPOSE_THREAD_ID,
    senderId,
    recipientIds: recipientId ? [recipientId] : [],
    mentionedIds: [],
    timestamp,
    text,
  };
  return { id: COMPOSE_THREAD_ID, messages: [message] };
}
