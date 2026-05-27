/**
 * Daily Digest Agent — direct API tools, no MCP middleware.
 *
 * Builds a daily digest by:
 * 1. Fetching the top Hacker News posts (free, no auth).
 * 2. Searching the web for restaurant recommendations via Jina AI's search API.
 * 3. Writing the result as a structured Notion page with action items.
 *
 * This example shows the opperai Agent loop driving plain `tool({ ... })`
 * functions against three small public APIs — no MCP server, no third-party
 * tool broker.
 *
 * Prerequisites:
 *   - OPPER_API_KEY in .env
 *   - JINA_API_KEY in .env (https://jina.ai/?sui=apikey)
 *   - NOTION_TOKEN in .env (notion.so/profile/integrations, "Internal" integration)
 *   - NOTION_PARENT_PAGE_ID in .env — a Notion page ID where the digest will be
 *     created as a child. Share that page with your integration first
 *     (Notion → page → Share → add the integration).
 *
 * Run with:
 *   cd typescript
 *   node --env-file=../.env node_modules/.bin/tsx \
 *     examples/agents/applied_agents/daily-digest-agent.ts
 */

import { z } from "zod";
import { Agent, tool } from "../../../src/index.js";
import type { Hooks } from "../../../src/index.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const NewsItemSchema = z.object({
  title: z.string().describe("News title"),
  url: z.string().nullable().optional().describe("Link to the article"),
  points: z.number().nullable().optional().describe("Number of points / upvotes"),
  summary: z.string().describe("Brief summary or commentary on the story"),
});

const RestaurantPickSchema = z.object({
  name: z.string().describe("Restaurant name"),
  location: z.string().describe("City and neighbourhood"),
  cuisine: z.string().describe("Type of cuisine"),
  reason: z.string().describe("Why it is worth a visit"),
  url: z.string().nullable().optional().describe("Source URL with more info"),
});

const ActionItemSchema = z.object({
  action: z.string().describe("The action to take"),
  source: z.enum(["news", "restaurant"]),
  link: z.string().nullable().optional().describe("Related link if available"),
});

const DailyDigestSchema = z.object({
  date: z.string().describe("Date of the digest, ISO 8601 (YYYY-MM-DD)"),
  news: z.array(NewsItemSchema).describe("Top news items from Hacker News"),
  restaurants: z.array(RestaurantPickSchema).describe("Restaurants worth trying"),
  actions: z.array(ActionItemSchema).describe("Action items derived from the digest"),
  notion_page_url: z.string().describe("URL of the created Notion page"),
});

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

const HN_BASE = "https://hacker-news.firebaseio.com/v0";

const fetchHnTopStories = tool({
  name: "fetch_hn_top_stories",
  description:
    "Fetch the top stories currently on Hacker News. Returns id, title, url, score (upvotes), author, and comment count.",
  parameters: z.object({
    limit: z.number().int().min(1).max(30).default(10).describe("Number of stories to fetch"),
  }),
  execute: async ({ limit }) => {
    const idsResp = await fetch(`${HN_BASE}/topstories.json`);
    if (!idsResp.ok) throw new Error(`HN topstories: HTTP ${idsResp.status}`);
    const ids = (await idsResp.json()) as number[];
    const picked = ids.slice(0, limit);

    const items = await Promise.all(
      picked.map(async (id) => {
        const r = await fetch(`${HN_BASE}/item/${id}.json`);
        if (!r.ok) throw new Error(`HN item ${id}: HTTP ${r.status}`);
        return (await r.json()) as Record<string, unknown>;
      }),
    );

    return items.map((it) => ({
      id: it.id,
      title: it.title,
      url: it.url,
      score: it.score,
      by: it.by,
      descendants: it.descendants,
    }));
  },
});

const searchWeb = tool({
  name: "search_web",
  description:
    "Search the web via Jina AI's search API. Pass a natural-language query (e.g. 'best ramen restaurants in Stockholm 2026'). Returns {title, url, description} results.",
  parameters: z.object({
    query: z.string().describe("Natural-language search query"),
    max_results: z.number().int().min(1).max(10).default(5),
  }),
  execute: async ({ query, max_results }) => {
    const apiKey = process.env.JINA_API_KEY;
    if (!apiKey) throw new Error("JINA_API_KEY not set");

    const resp = await fetch(`https://s.jina.ai/${encodeURIComponent(query)}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "X-Respond-With": "no-content",
      },
    });
    if (!resp.ok) throw new Error(`Jina search: HTTP ${resp.status}`);
    const json = (await resp.json()) as { data?: Array<Record<string, unknown>> };
    const data = json.data ?? [];

    return data.slice(0, max_results).map((item) => ({
      title: item.title,
      url: item.url,
      description: item.description ?? item.content ?? "",
    }));
  },
});

const createNotionPage = tool({
  name: "create_notion_page",
  description:
    "Create a Notion page as a child of NOTION_PARENT_PAGE_ID. `sections` is a list of {heading, body}. Each section is rendered as a heading_2 + paragraph block. Returns the URL of the created page.",
  parameters: z.object({
    title: z.string().describe("Page title"),
    sections: z
      .array(
        z.object({
          heading: z.string(),
          body: z.string(),
        }),
      )
      .describe("Sections to render as heading + paragraph blocks"),
  }),
  execute: async ({ title, sections }) => {
    const token = process.env.NOTION_TOKEN;
    const parentId = process.env.NOTION_PARENT_PAGE_ID;
    if (!token) throw new Error("NOTION_TOKEN not set");
    if (!parentId) throw new Error("NOTION_PARENT_PAGE_ID not set");

    const children: Array<Record<string, unknown>> = [];
    for (const section of sections) {
      const heading = (section.heading ?? "").trim();
      const body = (section.body ?? "").trim();
      if (heading) {
        children.push({
          object: "block",
          type: "heading_2",
          heading_2: {
            rich_text: [{ type: "text", text: { content: heading } }],
          },
        });
      }
      if (body) {
        // Notion caps text blocks at ~2000 chars; chunk conservatively.
        const chunks: string[] = [];
        for (let i = 0; i < body.length; i += 1900) chunks.push(body.slice(i, i + 1900));
        for (const chunk of chunks.length ? chunks : [""]) {
          children.push({
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [{ type: "text", text: { content: chunk } }],
            },
          });
        }
      }
    }

    const payload = {
      parent: { page_id: parentId },
      properties: {
        title: { title: [{ type: "text", text: { content: title } }] },
      },
      children,
    };

    const resp = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Notion: HTTP ${resp.status} — ${text}`);
    }
    const json = (await resp.json()) as { url?: string };
    return json.url ?? "";
  },
});

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

const today = new Date();
const dateStr = today.toISOString().split("T")[0];
const dayName = today.toLocaleDateString("en-US", { weekday: "long" });

const instructions = `
You are a personal productivity assistant that produces a daily digest.

Workflow for ${dateStr} (${dayName}):
1. Fetch the top Hacker News posts (use fetch_hn_top_stories).
   - Pick the most interesting 5-7.
   - Summarize what makes each one notable.

2. Search the web for restaurant recommendations (use search_web).
   - Aim for highly-rated restaurants in Stockholm with recent reviews.
   - Pick 3-5 worth trying this weekend.

3. Derive 2-4 action items from the news and restaurants.

4. Create a Notion page titled "Daily Digest - ${dateStr}" (use
   create_notion_page) with sections:
   - "Top News"
   - "Restaurant Picks"
   - "Actions"
   Render each section's body as concise plain text — one line per item with
   the title and link.

Be concise. Always include source URLs. Iterate through every step; do not
return an empty digest.
`.trim();

const hooks: Hooks = {
  onIterationStart: ({ iteration }) => {
    console.log(`\n--- Iteration ${iteration} ---`);
  },
  onToolStart: ({ name, input }) => {
    const s = JSON.stringify(input);
    console.log(`  -> ${name}(${s.slice(0, 120)}${s.length > 120 ? "..." : ""})`);
  },
  onToolEnd: ({ name, output, error, durationMs }) => {
    if (error) {
      console.log(`  x ${name} failed (${durationMs}ms): ${error}`);
    } else {
      const s = JSON.stringify(output);
      console.log(`  <- ${name} (${durationMs}ms): ${s.slice(0, 150)}${s.length > 150 ? "..." : ""}`);
    }
  },
  onAgentEnd: ({ result, error }) => {
    if (error) {
      console.log(`\nx Agent failed: ${error.message}`);
    } else if (result) {
      console.log(`\nv Agent completed in ${result.meta.iterations} iteration(s)`);
    }
  },
};

const agent = new Agent({
  name: "daily-digest",
  instructions,
  outputSchema: DailyDigestSchema,
  model: "anthropic/claude-sonnet-4-6",
  tools: [fetchHnTopStories, searchWeb, createNotionPage],
  maxIterations: 15,
  hooks,
});

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

for (const key of ["OPPER_API_KEY", "JINA_API_KEY", "NOTION_TOKEN", "NOTION_PARENT_PAGE_ID"]) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    console.error("See the comment block at the top of this file for setup steps.");
    process.exit(1);
  }
}

console.log("Daily Digest Agent");
console.log("=".repeat(60));
console.log(`Date: ${dateStr} (${dayName})\n`);
console.log("Running...\n");

try {
  const result = await agent.run(`Create my daily digest for ${dateStr} (${dayName}).`);
  const digest = result.output;
  console.log("=".repeat(60));
  console.log("DAILY DIGEST CREATED");
  console.log("=".repeat(60));
  console.log(`\nDate: ${digest.date}`);
  console.log(`News items: ${digest.news.length}`);
  console.log(`Restaurants: ${digest.restaurants.length}`);
  console.log(`Actions: ${digest.actions.length}`);
  console.log(`\nNotion page: ${digest.notion_page_url}`);
  console.log(`Tokens used: ${result.meta.usage.totalTokens}`);
  console.log(`Iterations: ${result.meta.iterations}`);
  console.log(`Tool calls: ${result.meta.toolCalls.length}`);
} catch (error: unknown) {
  const err = error as Error & { cause?: Error & { body?: unknown } };
  console.error(`\nError: ${err.message}`);
  if (err.cause) {
    console.error(`Cause: ${err.cause.message}`);
    if (err.cause.body) console.error("Body:", JSON.stringify(err.cause.body, null, 2));
  }
  process.exit(1);
}
