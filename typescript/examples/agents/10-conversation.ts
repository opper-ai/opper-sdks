// Conversation — multi-turn stateful interactions
// The Conversation class tracks items history across turns so the agent
// remembers prior context without you managing the items array manually.
import { z } from "zod";
import { Agent, tool } from "../../src/agent/index.js";

// A simple note-taking tool to show tool calls within conversations
const notes: string[] = [];

const saveNote = tool({
  name: "save_note",
  description: "Save a note for the user",
  parameters: z.object({
    text: z.string().describe("The note to save"),
  }),
  execute: async ({ text }) => {
    notes.push(text);
    return { saved: true, totalNotes: notes.length };
  },
});

const listNotes = tool({
  name: "list_notes",
  description: "List all saved notes",
  parameters: z.object({}),
  execute: async () => ({ notes }),
});

const agent = new Agent({
  name: "note-assistant",
  instructions: "You are a helpful note-taking assistant. Be concise.",
  tools: [saveNote, listNotes],
});

// --- Pattern 1: Multi-turn with .send() ---
console.log("=== Multi-turn conversation ===\n");
const conv = agent.conversation();

const r1 = await conv.send("My name is Alice. Remember that.");
console.log("Turn 1:", r1.output);

const r2 = await conv.send("Save a note: buy groceries");
console.log("Turn 2:", r2.output);
console.log("  Tool calls:", r2.meta.toolCalls.map((tc) => tc.name));

const r3 = await conv.send("Save another note: call dentist");
console.log("Turn 3:", r3.output);

const r4 = await conv.send("What's my name, and what notes have I saved?");
console.log("Turn 4:", r4.output);
console.log("  Tool calls:", r4.meta.toolCalls.map((tc) => tc.name));

console.log("\nConversation history:", conv.getItems().length, "items");

// --- Pattern 2: Streaming within a conversation ---
console.log("\n=== Streaming conversation turn ===\n");

const stream = conv.stream("Summarize everything we discussed.");
process.stdout.write("Turn 5: ");
for await (const event of stream) {
  if (event.type === "text_delta") {
    process.stdout.write(event.text);
  }
}
const r5 = await stream.result();
console.log("\n  Tokens:", r5.meta.usage.totalTokens);

// --- Pattern 3: Clear and start fresh ---
console.log("\n=== After clearing ===\n");
conv.clear();
console.log("Items after clear:", conv.getItems().length);

// The agent no longer remembers conversation context — it's a fresh turn
const r6 = await conv.send("What was the last thing I said to you?");
console.log("Turn 6 (no memory):", r6.output);
