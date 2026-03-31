import { Opper } from "opperai";

const opper = new Opper();

for await (const chunk of opper.stream("respond", {
  instructions: "Respond in Swedish",
  input: "What are the benefits of using an AI gateway?",
})) {
  if (chunk.type === "content") process.stdout.write(chunk.delta);
  if (chunk.type === "done") console.log();
}
