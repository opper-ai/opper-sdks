// =============================================================================
// Agent Layer — Turn Awareness
// =============================================================================

/**
 * Returns a system message to inject at the current iteration, or undefined
 * if no message is needed. Messages warn the model when it's running out of turns.
 *
 * Schedule:
 * - maxIterations - 2:  "2 turns remaining" warning (only if maxIterations >= 3)
 * - maxIterations:      "Final turn" warning
 * - maxIterations + 1:  "Turn limit exceeded" recovery message
 */
export function getWarningMessage(iteration: number, maxIterations: number): string | undefined {
  if (iteration === maxIterations - 2 && maxIterations >= 3) {
    return "[System] 2 turns remaining. Start wrapping up and prepare your final output.";
  }
  if (iteration === maxIterations) {
    return "[System] Final turn. Produce your final output now.";
  }
  if (iteration === maxIterations + 1) {
    return "[System] Turn limit exceeded. Respond with your best output now.";
  }
  return undefined;
}

/**
 * Returns true if this iteration is the bonus recovery turn (maxIterations + 1).
 */
export function isRecoveryTurn(iteration: number, maxIterations: number): boolean {
  return iteration === maxIterations + 1;
}
