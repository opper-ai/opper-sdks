// Function management: list, get, update, delete, revisions
import { z } from "zod";
import { Opper } from "../../src/index.js";

const opper = new Opper();

// ── List functions ──────────────────────────────────────────────────────────

const functions = await opper.functions.list();
console.log("── List functions ──");
console.log(`Found ${functions.length} cached function(s)`);
for (const fn of functions.slice(0, 5)) {
  console.log(`  - ${fn.name} (hits: ${fn.hit_count}, has_script: ${fn.has_script})`);
}

// ── Call a function (creates it if it doesn't exist) ────────────────────────

console.log("\n── Call function ──");
const result = await opper.call("sdk-test-managed-fn", {
  input_schema: z.object({ text: z.string() }),
  output_schema: z.object({ summary: z.string() }),
  input: { text: "Functions are auto-created on first call and cached for reuse." },
  model: "anthropic/claude-sonnet-4.6",
});
console.log("Result:", result.data.summary);

// ── Get function details ────────────────────────────────────────────────────

console.log("\n── Get function details ──");
const details = await opper.functions.get("sdk-test-managed-fn");
console.log("  Name:", details.name);
console.log("  Schema hash:", details.schema_hash);
console.log("  Generated at:", details.generated_at);
console.log("  Hit count:", details.hit_count);
console.log("  Script source (first 100 chars):", details.source.slice(0, 100) + "...");

// ── List revisions ──────────────────────────────────────────────────────────

console.log("\n── Revisions ──");
const revisions = await opper.functions.listRevisions("sdk-test-managed-fn");
console.log(`  ${revisions.length} revision(s)`);
for (const rev of revisions) {
  console.log(`  - rev ${rev.revision_id} (${rev.created_at}, current: ${rev.is_current})`);
}

// Get a specific revision if available
if (revisions.length > 0) {
  const rev = await opper.functions.getRevision(
    "sdk-test-managed-fn",
    revisions[0].revision_id,
  );
  console.log(`\n  Revision ${rev.revision_id} source (first 100 chars):`, rev.source.slice(0, 100) + "...");
}

// ── Stream a function ───────────────────────────────────────────────────────

console.log("\n── Stream function ──");
process.stdout.write("  ");
for await (const chunk of opper.stream("sdk-test-managed-fn", {
  input_schema: z.object({ text: z.string() }),
  output_schema: z.object({ summary: z.string() }),
  input: { text: "Streaming works on any function, cached or not." },
  model: "anthropic/claude-sonnet-4.6",
})) {
  if (chunk.type === "content") process.stdout.write(chunk.delta);
  if (chunk.type === "done") console.log();
}

// ── Delete function (cleanup) ───────────────────────────────────────────────

console.log("\n── Delete function ──");
await opper.functions.delete("sdk-test-managed-fn");
console.log("  Deleted sdk-test-managed-fn");
