#!/usr/bin/env python3
"""
Docs Snippet Runner — runs all Python docs code snippets against the local SDK.

Usage:
    PYTHONPATH=src uv run python docs_code_snippets/run_all.py

Requires OPPER_API_KEY to be set.
Each snippet includes its own setup/teardown via marker comments.
Only the code between # --- docs --- and # --- /docs --- goes into docs.
"""

import os
import subprocess
import sys
import time
from pathlib import Path

snippets_dir = Path(__file__).parent
project_dir = snippets_dir.parent

if not os.environ.get("OPPER_API_KEY"):
    print("Error: OPPER_API_KEY environment variable is not set.", file=sys.stderr)
    sys.exit(1)

files = sorted(f for f in snippets_dir.glob("*.py") if f.name != "run_all.py")

print(f"Found {len(files)} snippets, running all...\n")

results: list[dict] = []

for file in files:
    name = file.name
    start = time.time()
    sys.stdout.write(f"  {name} ... ")
    sys.stdout.flush()

    try:
        subprocess.run(
            [sys.executable, str(file)],
            cwd=str(project_dir),
            timeout=60,
            capture_output=True,
            check=True,
            env={**os.environ, "PYTHONPATH": str(project_dir / "src")},
        )
        ms = int((time.time() - start) * 1000)
        results.append({"name": name, "passed": True, "ms": ms})
        print(f"\033[32mPASS\033[0m ({ms}ms)")
    except subprocess.CalledProcessError as e:
        ms = int((time.time() - start) * 1000)
        error = (e.stderr or e.stdout or b"").decode().strip()
        results.append({"name": name, "passed": False, "ms": ms, "error": error})
        print(f"\033[31mFAIL\033[0m ({ms}ms)")
        for line in error.split("\n")[-5:]:
            print(f"    {line}")
    except subprocess.TimeoutExpired:
        ms = int((time.time() - start) * 1000)
        results.append({"name": name, "passed": False, "ms": ms, "error": "TIMEOUT"})
        print(f"\033[31mTIMEOUT\033[0m ({ms}ms)")

passed = sum(1 for r in results if r["passed"])
failed = sum(1 for r in results if not r["passed"])
total_ms = sum(r["ms"] for r in results)

print("\n" + "=" * 50)
print(f"Results: {passed} passed, {failed} failed, {len(results)} total ({total_ms / 1000:.1f}s)")

if failed > 0:
    print("\nFailed snippets:")
    for r in results:
        if not r["passed"]:
            print(f"  \033[31m✗\033[0m {r['name']}")
    sys.exit(1)

print("\n\033[32mAll snippets passed!\033[0m")
