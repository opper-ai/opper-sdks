#!/usr/bin/env npx tsx
// =============================================================================
// Example Runner — runs all getting-started examples and reports results
//
// Usage:
//   npx tsx examples/run-all.ts
//   npm run examples
//
// Requires OPPER_API_KEY to be set.
// =============================================================================

import { readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const examplesDir = resolve(__dirname, "getting-started");

if (!process.env.OPPER_API_KEY) {
  console.error("Error: OPPER_API_KEY environment variable is not set.");
  process.exit(1);
}

const files = readdirSync(examplesDir)
  .filter((f) => f.endsWith(".ts") && /^\d\d-/.test(f))
  .sort();

console.log(`Running ${files.length} examples...\n`);

const results: { name: string; passed: boolean; error?: string; durationMs: number }[] = [];

for (const file of files) {
  const name = file.replace(/\.ts$/, "");
  const filePath = resolve(examplesDir, file);
  const start = Date.now();

  process.stdout.write(`  ${name} ... `);

  try {
    execSync(`npx tsx "${filePath}"`, {
      cwd: resolve(__dirname, ".."),
      timeout: 60_000,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });
    const ms = Date.now() - start;
    results.push({ name, passed: true, durationMs: ms });
    console.log(`\x1b[32mPASS\x1b[0m (${ms}ms)`);
  } catch (err: unknown) {
    const ms = Date.now() - start;
    const error =
      err instanceof Error
        ? (err as { stderr?: Buffer }).stderr?.toString().trim() || err.message
        : String(err);
    results.push({ name, passed: false, error, durationMs: ms });
    console.log(`\x1b[31mFAIL\x1b[0m (${ms}ms)`);
    // Print first few lines of error
    const lines = error.split("\n").slice(0, 5);
    for (const line of lines) {
      console.log(`    ${line}`);
    }
  }
}

// Summary
const passed = results.filter((r) => r.passed).length;
const failed = results.filter((r) => !r.passed).length;
const totalMs = results.reduce((sum, r) => sum + r.durationMs, 0);

console.log("\n" + "=".repeat(50));
console.log(
  `Results: ${passed} passed, ${failed} failed, ${results.length} total (${(totalMs / 1000).toFixed(1)}s)`,
);

if (failed > 0) {
  console.log("\nFailed examples:");
  for (const r of results.filter((r) => !r.passed)) {
    console.log(`  \x1b[31m✗\x1b[0m ${r.name}`);
  }
  process.exit(1);
}

console.log("\n\x1b[32mAll examples passed!\x1b[0m");
