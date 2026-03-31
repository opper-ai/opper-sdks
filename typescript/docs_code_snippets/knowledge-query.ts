import { Opper } from "opperai";

const opper = new Opper();

const results = await opper.knowledge.query("kb-id", {
  query: "typed language for web",
  top_k: 3,
});
for (const r of results) {
  console.log(`[${r.score.toFixed(3)}] ${r.content.slice(0, 80)}`);
}
