// Your first agent — a simple agentic loop with no tools
// The Agent class handles the loop: it calls the model, collects the response,
// and returns when the model produces a final answer.
import { Agent } from "../../src/index.js";

const agent = new Agent({
  name: "my-first-agent",
  instructions: "You are a helpful assistant. Answer concisely.",
});

const result = await agent.run("What is the capital of France, and what is it famous for?");

console.log("Output:", result.output);
console.log("Iterations:", result.meta.iterations);
console.log("Tokens used:", result.meta.usage.totalTokens);
