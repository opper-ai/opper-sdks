#!/usr/bin/env npx tsx
// =============================================================================
// Example Runner — runs example suites and reports results
//
// Usage:
//   npx tsx examples/run-all.ts                       # getting-started, no slow
//   npx tsx examples/run-all.ts --all                 # getting-started, include slow
//   npx tsx examples/run-all.ts --agents              # agents only
//   npx tsx examples/run-all.ts --with-agents         # both suites
//   npx tsx examples/run-all.ts --with-agents --all   # both, include slow
//   npm run examples
//
// Requires OPPER_API_KEY to be set.
// =============================================================================

import { execSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_ROOT = __dirname;

if (!process.env.OPPER_API_KEY) {
  console.error("Error: OPPER_API_KEY environment variable is not set.");
  process.exit(1);
}

// Slow / external-dependency examples that are skipped without --all.
const SLOW_EXAMPLES = new Set(["06-video", "11-real-time"]);

const args = process.argv.slice(2);
const includeSlow = args.includes("--all");
const onlyAgents = args.includes("--agents");
const withAgents = args.includes("--with-agents");

if (onlyAgents && withAgents) {
  console.error("Error: pass either --agents or --with-agents, not both.");
  process.exit(1);
}

interface Suite {
  label: string;
  dir: string;
}

const suites: Suite[] = [];
if (onlyAgents) {
  suites.push({ label: "agents", dir: resolve(EXAMPLES_ROOT, "agents") });
} else if (withAgents) {
  suites.push({ label: "getting-started", dir: resolve(EXAMPLES_ROOT, "getting-started") });
  suites.push({ label: "agents", dir: resolve(EXAMPLES_ROOT, "agents") });
} else {
  suites.push({ label: "getting-started", dir: resolve(EXAMPLES_ROOT, "getting-started") });
}

function findExamples(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".ts") && /^\d\d[a-z]?-/.test(f))
    .sort();
}

interface Result {
  name: string;
  suite: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

function runSuite(label: string, dir: string): Result[] {
  const files = findExamples(dir);
  console.log(`\n=== ${label} (${files.length} examples) ===\n`);
  const results: Result[] = [];

  for (const file of files) {
    const name = file.replace(/\.ts$/, "");
    const filePath = resolve(dir, file);

    if (!includeSlow && SLOW_EXAMPLES.has(name)) {
      console.log(`  ${name} ... \x1b[33mSKIP\x1b[0m (slow, use --all to include)`);
      continue;
    }

    process.stdout.write(`  ${name} ... `);
    const start = Date.now();

    try {
      execSync(`npx tsx "${filePath}"`, {
        cwd: resolve(EXAMPLES_ROOT, ".."),
        timeout: 120_000,
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env },
      });
      const ms = Date.now() - start;
      results.push({ name, suite: label, passed: true, durationMs: ms });
      console.log(`\x1b[32mPASS\x1b[0m (${ms}ms)`);
    } catch (err: unknown) {
      const ms = Date.now() - start;
      const error =
        err instanceof Error
          ? (err as { stderr?: Buffer }).stderr?.toString().trim() || err.message
          : String(err);
      results.push({ name, suite: label, passed: false, error, durationMs: ms });
      console.log(`\x1b[31mFAIL\x1b[0m (${ms}ms)`);
      const lines = error.split("\n").slice(0, 5);
      for (const line of lines) {
        console.log(`    ${line}`);
      }
    }
  }

  return results;
}

const allResults: Result[] = [];
for (const suite of suites) {
  allResults.push(...runSuite(suite.label, suite.dir));
}

const passed = allResults.filter((r) => r.passed).length;
const failed = allResults.filter((r) => !r.passed).length;
const totalMs = allResults.reduce((sum, r) => sum + r.durationMs, 0);

console.log("\n" + "=".repeat(50));
console.log(
  `Results: ${passed} passed, ${failed} failed, ${allResults.length} total (${(totalMs / 1000).toFixed(1)}s)`,
);

if (failed > 0) {
  console.log("\nFailed examples:");
  for (const r of allResults.filter((r) => !r.passed)) {
    console.log(`  \x1b[31m✗\x1b[0m [${r.suite}] ${r.name}`);
  }
  process.exit(1);
}

console.log("\n\x1b[32mAll examples passed!\x1b[0m");
