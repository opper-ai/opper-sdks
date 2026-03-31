import { Opper } from "opperai";

const opper = new Opper();

// Delete documents matching filters
await opper.knowledge.deleteDocuments("kb-id", {
  filters: [{ field: "source", operation: "=", value: "outdated" }],
});
