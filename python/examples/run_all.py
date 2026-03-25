#!/usr/bin/env python3
"""Example runner — runs all getting-started examples and reports results.

Usage:
    uv run python examples/run_all.py          # skip slow examples
    uv run python examples/run_all.py --all    # include slow examples (video, realtime)

Requires OPPER_API_KEY to be set.
"""

import os
import subprocess
import sys
import time
from pathlib import Path

examples_dir = Path(__file__).parent / "getting-started"

if not os.environ.get("OPPER_API_KEY"):
    print("Error: OPPER_API_KEY environment variable is not set.", file=sys.stderr)
    sys.exit(1)

run_all = "--all" in sys.argv

# Slow examples that are skipped by default (video generation, realtime)
SLOW_EXAMPLES = {"06_video", "11_real_time"}

files = sorted(f for f in examples_dir.iterdir() if f.suffix == ".py" and f.name[0].isdigit())

print(f"Running {len(files)} examples...\n")

results: list[dict] = []

for file in files:
    name = file.stem

    if not run_all and name in SLOW_EXAMPLES:
        print(f"  {name} ... \033[33mSKIP\033[0m (slow, use --all to include)")
        continue

    sys.stdout.write(f"  {name} ... ")
    sys.stdout.flush()

    start = time.monotonic()

    try:
        subprocess.run(
            [sys.executable, str(file)],
            cwd=str(Path(__file__).parent.parent),
            timeout=120,
            capture_output=True,
            check=True,
            env={**os.environ},
        )
        ms = int((time.monotonic() - start) * 1000)
        results.append({"name": name, "passed": True, "duration_ms": ms})
        print(f"\033[32mPASS\033[0m ({ms}ms)")
    except subprocess.TimeoutExpired:
        ms = int((time.monotonic() - start) * 1000)
        results.append({"name": name, "passed": False, "error": "TIMEOUT", "duration_ms": ms})
        print(f"\033[31mTIMEOUT\033[0m ({ms}ms)")
    except subprocess.CalledProcessError as e:
        ms = int((time.monotonic() - start) * 1000)
        error = e.stderr.decode().strip() if e.stderr else str(e)
        results.append({"name": name, "passed": False, "error": error, "duration_ms": ms})
        print(f"\033[31mFAIL\033[0m ({ms}ms)")
        # Print first few lines of error
        for line in error.split("\n")[:5]:
            print(f"    {line}")

# Summary
passed = sum(1 for r in results if r["passed"])
failed = sum(1 for r in results if not r["passed"])
total_ms = sum(r["duration_ms"] for r in results)

print("\n" + "=" * 50)
print(f"Results: {passed} passed, {failed} failed, {len(results)} total ({total_ms / 1000:.1f}s)")

if failed > 0:
    print("\nFailed examples:")
    for r in results:
        if not r["passed"]:
            print(f"  \033[31m✗\033[0m {r['name']}")
    sys.exit(1)

print("\n\033[32mAll examples passed!\033[0m")
