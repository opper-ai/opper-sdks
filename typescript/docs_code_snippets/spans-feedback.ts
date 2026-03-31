import { Opper } from "opperai";

const opper = new Opper();

await opper.spans.feedback("span-id", { score: 1, comment: "Great response" });
