import { Opper } from "opperai";

const opper = new Opper();

for await (const chunk of opper.stream("creative_writer", {
  instructions: "Write a short story about a robot learning to paint.",
  input: { topic: "robot artist" },
})) {
  if (chunk.type === "content") {
    process.stdout.write(chunk.delta);
  }
  if (chunk.type === "done") {
    console.log();
  }
}
