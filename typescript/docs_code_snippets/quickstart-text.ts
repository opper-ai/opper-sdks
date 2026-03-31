import { Opper } from "opperai";

const opper = new Opper();

const result = await opper.call("respond", {
  instructions: "Respond in Swedish",
  input: "What are the benefits of using an AI gateway?",
});

console.log(result.data);
