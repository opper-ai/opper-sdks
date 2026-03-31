import { z } from "zod";
import { Opper } from "opperai";

const opper = new Opper();

// setup
const fnName = `docs-snippet-fn-${Date.now()}`;
await opper.call(fnName, { input: "hello", output_schema: z.object({ reply: z.string() }) });
// /setup

// --- docs ---
const revisions = await opper.functions.listRevisions(fnName);
for (const rev of revisions) {
  console.log(`Revision ${rev.revision_id} (current: ${rev.is_current}, created: ${rev.created_at})`);
}
// --- /docs ---

// cleanup
await opper.functions.delete(fnName);
