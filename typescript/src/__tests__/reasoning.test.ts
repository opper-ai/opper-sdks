import { describe, expect, it } from "vitest";
import { extractReasoning, accumulateReasoning } from "../agent/reasoning.js";
import type { OROutputItem } from "../agent/types.js";

describe("extractReasoning", () => {
  it("returns undefined when no reasoning items present", () => {
    const output: OROutputItem[] = [
      {
        type: "message",
        id: "msg_001",
        role: "assistant",
        status: "completed",
        content: [{ type: "output_text", text: "Hello" }],
      },
    ];
    expect(extractReasoning(output)).toBeUndefined();
  });

  it("extracts reasoning summary text from reasoning output item", () => {
    const output: OROutputItem[] = [
      {
        type: "reasoning",
        id: "rs_001",
        summary: [{ type: "summary_text", text: "I need to think about this carefully." }],
      },
      {
        type: "message",
        id: "msg_001",
        role: "assistant",
        status: "completed",
        content: [{ type: "output_text", text: "Hello" }],
      },
    ];
    expect(extractReasoning(output)).toBe("I need to think about this carefully.");
  });

  it("concatenates multiple summary entries", () => {
    const output: OROutputItem[] = [
      {
        type: "reasoning",
        id: "rs_001",
        summary: [
          { type: "summary_text", text: "First thought." },
          { type: "summary_text", text: " Second thought." },
        ],
      },
    ];
    expect(extractReasoning(output)).toBe("First thought. Second thought.");
  });

  it("returns undefined when reasoning item has empty summary", () => {
    const output: OROutputItem[] = [
      {
        type: "reasoning",
        id: "rs_001",
        summary: [],
      },
    ];
    expect(extractReasoning(output)).toBeUndefined();
  });

  it("returns undefined for empty output array", () => {
    expect(extractReasoning([])).toBeUndefined();
  });
});

describe("accumulateReasoning", () => {
  it("pushes text to the collected array", () => {
    const collected: string[] = [];
    accumulateReasoning(collected, "First turn reasoning");
    accumulateReasoning(collected, "Second turn reasoning");
    expect(collected).toEqual(["First turn reasoning", "Second turn reasoning"]);
  });
});
