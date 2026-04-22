#!/usr/bin/env python3
"""Example runner — runs example suites and reports results.

Usage:
    uv run python examples/run_all.py                    # getting-started, no slow
    uv run python examples/run_all.py --all              # getting-started, include slow
    uv run python examples/run_all.py --agents           # agents only
    uv run python examples/run_all.py --with-agents      # both suites
    uv run python examples/run_all.py --with-agents --all  # both, include slow

Requires OPPER_API_KEY to be set.
"""

import os
import subprocess
import sys
import time
from pathlib import Path

EXAMPLES_ROOT = Path(__file__).parent

# Slow / external-dependency examples that are skipped without --all.
SLOW_EXAMPLES = {
    "06_video",
    "11_real_time",
}


def find_examples(suite_dir: Path) -> list[Path]:
    """Return numbered .py files at the top of a suite dir, sorted."""
    return sorted(
        f for f in suite_dir.iterdir() if f.suffix == ".py" and f.name[0].isdigit()
    )


def run_suite(label: str, files: list[Path], include_slow: bool) -> list[dict]:
    """Run every file in a suite and return per-example results."""
    print(f"\n=== {label} ({len(files)} examples) ===\n")
    results: list[dict] = []

    for file in files:
        name = file.stem

        if not include_slow and name in SLOW_EXAMPLES:
            print(f"  {name} ... \033[33mSKIP\033[0m (slow, use --all to include)")
            continue

        sys.stdout.write(f"  {name} ... ")
        sys.stdout.flush()
        start = time.monotonic()

        try:
            subprocess.run(
                [sys.executable, str(file)],
                cwd=str(EXAMPLES_ROOT.parent),
                timeout=120,
                capture_output=True,
                check=True,
                env={**os.environ},
            )
            ms = int((time.monotonic() - start) * 1000)
            results.append({"name": name, "suite": label, "passed": True, "duration_ms": ms})
            print(f"\033[32mPASS\033[0m ({ms}ms)")
        except subprocess.TimeoutExpired:
            ms = int((time.monotonic() - start) * 1000)
            results.append(
                {"name": name, "suite": label, "passed": False, "error": "TIMEOUT", "duration_ms": ms}
            )
            print(f"\033[31mTIMEOUT\033[0m ({ms}ms)")
        except subprocess.CalledProcessError as e:
            ms = int((time.monotonic() - start) * 1000)
            error = e.stderr.decode().strip() if e.stderr else str(e)
            results.append(
                {"name": name, "suite": label, "passed": False, "error": error, "duration_ms": ms}
            )
            print(f"\033[31mFAIL\033[0m ({ms}ms)")
            for line in error.split("\n")[:5]:
                print(f"    {line}")

    return results


def main() -> int:
    if not os.environ.get("OPPER_API_KEY"):
        print("Error: OPPER_API_KEY environment variable is not set.", file=sys.stderr)
        return 1

    args = sys.argv[1:]
    include_slow = "--all" in args
    only_agents = "--agents" in args
    with_agents = "--with-agents" in args

    if only_agents and with_agents:
        print("Error: pass either --agents or --with-agents, not both.", file=sys.stderr)
        return 1

    suites: list[tuple[str, Path]] = []
    if only_agents:
        suites.append(("agents", EXAMPLES_ROOT / "agents"))
    elif with_agents:
        suites.append(("getting-started", EXAMPLES_ROOT / "getting-started"))
        suites.append(("agents", EXAMPLES_ROOT / "agents"))
    else:
        suites.append(("getting-started", EXAMPLES_ROOT / "getting-started"))

    all_results: list[dict] = []
    for label, path in suites:
        files = find_examples(path)
        all_results.extend(run_suite(label, files, include_slow))

    passed = sum(1 for r in all_results if r["passed"])
    failed = sum(1 for r in all_results if not r["passed"])
    total_ms = sum(r["duration_ms"] for r in all_results)

    print("\n" + "=" * 50)
    print(
        f"Results: {passed} passed, {failed} failed, {len(all_results)} total ({total_ms / 1000:.1f}s)"
    )

    if failed > 0:
        print("\nFailed examples:")
        for r in all_results:
            if not r["passed"]:
                print(f"  \033[31m✗\033[0m [{r['suite']}] {r['name']}")
        return 1

    print("\n\033[32mAll examples passed!\033[0m")
    return 0


if __name__ == "__main__":
    sys.exit(main())
