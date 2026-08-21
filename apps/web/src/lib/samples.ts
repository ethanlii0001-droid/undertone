/**
 * One-click sample threads (Prompt 9A §2). Each row is just the editor's
 * {sender, recipient, text} shape — `nextMessageId`/`timestampForIndex` in
 * adapter.ts fill in the rest when a sample is loaded into the editor.
 */
export interface SampleRow {
  sender: string;
  recipient: string;
  text: string;
}

export interface SampleThread {
  id: string;
  label: string;
  description: string;
  rows: SampleRow[];
}

export const SAMPLE_THREADS: SampleThread[] = [
  {
    id: "polite-escalation",
    label: "Polite escalation",
    description: "Same request, repeated politely, as outside pressure builds.",
    rows: [
      {
        sender: "Alice",
        recipient: "Bob",
        text: "Hey, whenever you get a chance, could you take a look at the deck? No rush at all.",
      },
      {
        sender: "Bob",
        recipient: "Alice",
        text: "Will do, thanks!",
      },
      {
        sender: "Alice",
        recipient: "Bob",
        text: "Just following up — could you send over the deck when you get a moment? Legal is waiting on it before they can review the contract.",
      },
      {
        sender: "Alice",
        recipient: "Bob",
        text: "Circling back once more — could you please send the deck? Legal has escalated this to my director since we're now blocking the client signature.",
      },
    ],
  },
  {
    id: "deadline-dependency",
    label: "Deadline + dependency",
    description: "A softened request carrying an explicit deadline and a workflow dependency.",
    rows: [
      {
        sender: "Carla",
        recipient: "Dan",
        text: "If it's not too much trouble, would you mind sending over the budget numbers by Thursday? Finance is blocked on this until they're in.",
      },
    ],
  },
  {
    id: "genuinely-optional",
    label: "Genuinely optional",
    description: "A negative-control case: hedged phrasing with no surrounding pressure.",
    rows: [
      {
        sender: "Erin",
        recipient: "Frank",
        text: "Whenever you get a chance, could you take a look at the old onboarding doc? No rush at all, totally up to you.",
      },
    ],
  },
];
