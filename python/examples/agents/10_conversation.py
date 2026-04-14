# Conversation — multi-turn stateful interactions
# The Conversation class tracks items history across turns so the agent
# remembers prior context without you managing the items array manually.

import asyncio
import sys

from opperai.agent import Agent, tool

# A simple note-taking tool to show tool calls within conversations
notes: list[str] = []


@tool
def save_note(text: str) -> dict:
    """Save a note for the user."""
    notes.append(text)
    return {"saved": True, "total_notes": len(notes)}


@tool
def list_notes() -> dict:
    """List all saved notes."""
    return {"notes": notes}


async def main() -> None:
    agent = Agent(
        name="note-assistant",
        instructions="You are a helpful note-taking assistant. Be concise.",
        tools=[save_note, list_notes],
    )

    # --- Pattern 1: Multi-turn with .send() ---
    print("=== Multi-turn conversation ===\n")
    conv = agent.conversation()

    r1 = await conv.send("My name is Alice. Remember that.")
    print("Turn 1:", r1.output)

    r2 = await conv.send("Save a note: buy groceries")
    print("Turn 2:", r2.output)
    print("  Tool calls:", [tc.name for tc in r2.meta.tool_calls])

    r3 = await conv.send("Save another note: call dentist")
    print("Turn 3:", r3.output)

    r4 = await conv.send("What's my name, and what notes have I saved?")
    print("Turn 4:", r4.output)
    print("  Tool calls:", [tc.name for tc in r4.meta.tool_calls])

    print(f"\nConversation history: {len(conv.get_items())} items")

    # --- Pattern 2: Streaming within a conversation ---
    print("\n=== Streaming conversation turn ===\n")

    stream = conv.stream("Summarize everything we discussed.")
    sys.stdout.write("Turn 5: ")
    async for event in stream:
        if event.type == "text_delta":
            sys.stdout.write(event.text)
            sys.stdout.flush()
    r5 = await stream.result()
    print(f"\n  Tokens: {r5.meta.usage.total_tokens}")

    # --- Pattern 3: Clear and start fresh ---
    print("\n=== After clearing ===\n")
    conv.clear()
    print(f"Items after clear: {len(conv.get_items())}")

    r6 = await conv.send("What was the last thing I said to you?")
    print("Turn 6 (no memory):", r6.output)


if __name__ == "__main__":
    asyncio.run(main())
