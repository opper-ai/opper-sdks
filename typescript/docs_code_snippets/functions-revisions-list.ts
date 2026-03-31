import { Opper } from "opperai";

const opper = new Opper();

const revisions = await opper.functions.listRevisions("my-function");
for (const rev of revisions) {
  console.log(`Revision ${rev.revision_id} (current: ${rev.is_current}, created: ${rev.created_at})`);
}
