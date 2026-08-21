/**
 * UI-only shapes for the thread editor. Deliberately separate from the
 * engine's `Message`/`Thread` — the editor only collects sender, recipient,
 * and text; `adapter.ts` fills in every other `Message` field the engine
 * requires.
 */
export interface EditorMessage {
  id: string;
  sender: string;
  recipient: string;
  text: string;
}
