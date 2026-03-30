// Web tools: search the web and fetch URL content
import { Opper } from "../../src/index.js";

const opper = new Opper();

// ── Web search ──────────────────────────────────────────────────────────────

console.log("── Web search ──");
const searchResults = await opper.beta.web.search({ query: "Opper AI platform" });

for (const result of searchResults.results.slice(0, 5)) {
  console.log(`  ${result.title}`);
  console.log(`  ${result.url}`);
  console.log(`  ${result.snippet}\n`);
}

// ── Fetch URL content ───────────────────────────────────────────────────────

console.log("── Fetch URL ──");
const page = await opper.beta.web.fetch({ url: "https://docs.opper.ai" });
console.log("Content (first 500 chars):", page.content.slice(0, 500) + "...");
