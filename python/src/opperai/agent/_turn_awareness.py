"""Agent SDK — Turn awareness.

Injects system messages near the iteration limit so the model
can wrap up gracefully.
"""

from __future__ import annotations


def get_warning_message(iteration: int, max_iterations: int) -> str | None:
    """Return a warning message to inject at the given iteration, or None."""
    if iteration == max_iterations - 2 and max_iterations >= 3:
        return (
            "[System] 2 turns remaining. "
            "Start wrapping up and prepare your final output."
        )
    if iteration == max_iterations:
        return "[System] Final turn. Produce your final output now."
    if iteration == max_iterations + 1:
        return (
            "[System] Turn limit exceeded. "
            "Respond with your best output now."
        )
    return None


def is_recovery_turn(iteration: int, max_iterations: int) -> bool:
    """Return True if this iteration is the bonus recovery turn."""
    return iteration == max_iterations + 1
