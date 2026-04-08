import { describe, expect, it } from "vitest";
import { getWarningMessage, isRecoveryTurn } from "../agent/turn-awareness.js";

describe("getWarningMessage", () => {
  it("returns undefined for early iterations", () => {
    expect(getWarningMessage(1, 10)).toBeUndefined();
    expect(getWarningMessage(5, 10)).toBeUndefined();
    expect(getWarningMessage(7, 10)).toBeUndefined();
  });

  it("returns warning at maxIterations - 2", () => {
    const msg = getWarningMessage(8, 10);
    expect(msg).toBeDefined();
    expect(msg).toContain("2 turns remaining");
  });

  it("returns final turn message at maxIterations", () => {
    const msg = getWarningMessage(10, 10);
    expect(msg).toBeDefined();
    expect(msg).toContain("Final turn");
  });

  it("returns recovery message at maxIterations + 1", () => {
    const msg = getWarningMessage(11, 10);
    expect(msg).toBeDefined();
    expect(msg).toContain("Turn limit exceeded");
  });

  it("skips N-2 warning when maxIterations < 3", () => {
    expect(getWarningMessage(0, 2)).toBeUndefined();
    expect(getWarningMessage(1, 2)).toBeUndefined();
    expect(getWarningMessage(2, 2)).toContain("Final turn");
    expect(getWarningMessage(3, 2)).toContain("Turn limit exceeded");
  });

  it("handles maxIterations = 1", () => {
    expect(getWarningMessage(1, 1)).toContain("Final turn");
    expect(getWarningMessage(2, 1)).toContain("Turn limit exceeded");
  });

  it("returns undefined for iterations beyond recovery", () => {
    expect(getWarningMessage(12, 10)).toBeUndefined();
  });

  it("does not fire N-2 warning at non-matching iterations", () => {
    expect(getWarningMessage(2, 5)).toBeUndefined();
    expect(getWarningMessage(3, 5)).toContain("2 turns remaining");
    expect(getWarningMessage(4, 5)).toBeUndefined();
  });
});

describe("isRecoveryTurn", () => {
  it("returns false for normal iterations", () => {
    expect(isRecoveryTurn(1, 10)).toBe(false);
    expect(isRecoveryTurn(10, 10)).toBe(false);
  });

  it("returns true for maxIterations + 1", () => {
    expect(isRecoveryTurn(11, 10)).toBe(true);
  });

  it("returns false for iterations beyond recovery", () => {
    expect(isRecoveryTurn(12, 10)).toBe(false);
  });
});
