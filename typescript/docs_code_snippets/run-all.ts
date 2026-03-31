#!/usr/bin/env npx tsx
// =============================================================================
// Docs Snippet Runner — runs all docs code snippets against the local SDK
//
// Usage:
//   npx tsx docs_code_snippets/run-all.ts
//
// Requires OPPER_API_KEY to be set.
// Each snippet includes its own setup/teardown via marker comments.
// Only the code between // --- docs --- and // --- /docs --- goes into docs.
// =============================================================================

import { readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const snippetsDir = resolve(__dirname);
const tsconfigPath = resolve(__dirname, "tsconfig.json");

if (!process.env.OPPER_API_KEY) {
  console.error("Error: OPPER_API_KEY environment variable is not set.");
  process.exit(1);
}

const SKIP = new Set<string>([]);

const files = readdirSync(snippetsDir)
  .filter((f) => f.endsWith(".ts") && f !== "run-all.ts")
  .sort();

const runnable = files.length - SKIP.size;
console.log(`Found ${files.length} snippets, running ${runnable}...\n`);

const results: { name: string; passed: boolean; error?: string; durationMs: number }[] = [];

for (const file of files) {
  if (SKIP.has(file)) {
    console.log(`  ${file} ... \x1b[33mSKIP\x1b[0m`);
    continue;
  }

  const filePath = resolve(snippetsDir, file);
  const start = Date.now();

  process.stdout.write(`  ${file} ... `);

  try {
    execSync(`npx tsx --tsconfig "${tsconfigPath}" "${filePath}"`, {
      cwd: resolve(__dirname, ".."),
      timeout: 60_000,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });
    const ms = Date.now() - start;
    results.push({ name: file, passed: true, durationMs: ms });
    console.log(`\x1b[32mPASS\x1b[0m (${ms}ms)`);
  } catch (err: unknown) {
    const ms = Date.now() - start;
    const error =
      err instanceof Error
        ? (err as { stderr?: Buffer }).stderr?.toString().trim() || err.message
        : String(err);
    results.push({ name: file, passed: false, error, durationMs: ms });
    console.log(`\x1b[31mFAIL\x1b[0m (${ms}ms)`);
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
  console.log("\nFailed snippets:");
  for (const r of results.filter((r) => !r.passed)) {
    console.log(`  \x1b[31m✗\x1b[0m ${r.name}`);
  }
  process.exit(1);
}

console.log("\n\x1b[32mAll snippets passed!\x1b[0m");
