// Function management: list, get details, revisions
import { Opper } from "../../src/index.js";

const client = new Opper();

// List functions
const list = await client.functions.listFunctions();
console.log(`Found ${list.functions.length} cached function(s)`);
for (const fn of list.functions.slice(0, 5)) {
  console.log(`  - ${fn.name} (hits: ${fn.hit_count}, has_script: ${fn.has_script})`);
}

// If there are any functions, get details on the first one
if (list.functions.length > 0) {
  const name = list.functions[0].name;
  const details = await client.functions.getFunction(name);
  console.log(`\nDetails for "${name}":`);
  console.log("  Schema hash:", details.schema_hash);
  console.log("  Generated at:", details.generated_at);

  // List revisions
  const revisions = await client.functions.listRevisions(name);
  console.log(`  Revisions: ${revisions.revisions.length}`);
}
