/**
 * Daily Digest Agent with Multi-MCP Integration
 *
 * Demonstrates a real-world agent that combines multiple MCP servers to:
 * 1. Fetch emails from the last 24h via Gmail MCP
 * 2. Get top Hacker News posts via HN MCP
 * 3. Create a structured Notion page with news, emails, and action items
 * 4. On Thursday/Friday, add Stockholm restaurant recommendations via Search MCP
 *
 * Prerequisites:
 *   - OPPER_API_KEY in .env
 *   - Composio MCP URLs in .env (see below)
 *   - npm install @modelcontextprotocol/sdk
 *
 * Required .env variables:
 *   COMPOSIO_GMAIL_MCP_URL=...
 *   COMPOSIO_HACKERNEWS_MCP_URL=...
 *   COMPOSIO_NOTION_MCP_URL=...
 *   COMPOSIO_SEARCH_MCP_URL=...
 *   COMPOSIO_API_KEY=... (optional, for auth)
 *
 * Run with: node --env-file=../.env node_modules/.bin/tsx examples/agents/applied_agents/daily-digest-agent.ts
 */

import { z } from "zod";
import { Agent, mcp } from "../../../src/index.js";
import type { MCPStreamableHTTPConfig } from "../../../src/index.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const EmailSummarySchema = z.object({
  sender: z.string().describe("Email sender"),
  subject: z.string().describe("Email subject"),
  summary: z.string().describe("Brief summary of the email content"),
  action_required: z.boolean().describe("Whether this email requires action"),
  priority: z.enum(["high", "medium", "low"]),
});

const NewsItemSchema = z.object({
  title: z.string().describe("News title"),
  url: z.string().optional().describe("Link to the article"),
  points: z.number().optional().describe("Number of points"),
  summary: z.string().describe("Brief summary"),
  relevance: z.string().describe("Why this might be interesting"),
});

const ActionItemSchema = z.object({
  action: z.string().describe("The action to take"),
  source: z.enum(["email", "news", "other"]),
  link: z.string().optional().describe("Related link if available"),
  priority: z.enum(["high", "medium", "low"]),
});

const WeekendRecommendationSchema = z.object({
  name: z.string().describe("Restaurant name"),
  cuisine: z.string().describe("Type of cuisine"),
  description: z.string().describe("Brief description"),
  reason: z.string().describe("Why this is recommended"),
});

const DailyDigestSchema = z.object({
  date: z.string().describe("Date of the digest"),
  emails: z.array(EmailSummarySchema).describe("Important emails from last 24h"),
  news: z.array(NewsItemSchema).describe("Top news items from Hacker News"),
  actions: z.array(ActionItemSchema).describe("Action items for today"),
  weekend_recommendations: z
    .array(WeekendRecommendationSchema)
    .optional()
    .describe("Weekend restaurant recommendations (Thu/Fri only)"),
  notion_page_created: z.boolean().describe("Whether the Notion page was created"),
  notion_page_url: z.string().optional().describe("URL to the created Notion page"),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEnvOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}\n` +
        "Get your Composio MCP URLs from https://app.composio.dev/",
    );
  }
  return value;
}

function isWeekendPlanningDay(): boolean {
  const day = new Date().getDay();
  return day === 4 || day === 5; // Thursday or Friday
}

/** Create a Composio MCP server config with optional auth. */
function composioMCP(name: string, envKey: string): MCPStreamableHTTPConfig {
  const apiKey = process.env.COMPOSIO_API_KEY;
  return {
    name,
    transport: "streamable-http",
    url: getEnvOrThrow(envKey),
    ...(apiKey ? { headers: { Authorization: `Bearer ${apiKey}` } } : {}),
  };
}

// ---------------------------------------------------------------------------
// MCP Servers — defined as reusable constants
// ---------------------------------------------------------------------------

const GmailMCP = mcp(composioMCP("composio-gmail", "COMPOSIO_GMAIL_MCP_URL"));
const HackerNewsMCP = mcp(composioMCP("composio-hackernews", "COMPOSIO_HACKERNEWS_MCP_URL"));
const NotionMCP = mcp(composioMCP("composio-notion", "COMPOSIO_NOTION_MCP_URL"));
const SearchMCP = mcp(composioMCP("composio-search", "COMPOSIO_SEARCH_MCP_URL"));

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

const today = new Date();
const dateStr = today.toISOString().split("T")[0];
const dayName = today.toLocaleDateString("en-US", { weekday: "long" });
const isWeekendPrep = isWeekendPlanningDay();

let instructions = `
You are a personal productivity assistant that creates comprehensive daily digests.

Your workflow:
1. Fetch emails from the last 24 hours using Gmail tools
   - Focus on important/unread emails
   - Identify emails that require action
   - Summarize key content

2. Fetch top 10 Hacker News posts from the last day
   - Get the most upvoted posts
   - Summarize what makes them interesting

3. Generate action items based on emails and news
   - Extract actionable tasks from emails
   - Include relevant links

4. Create a Notion page titled "Daily Digest - ${dateStr}" with sections:
   - "Main News last 24h"
   - "Main Email last 24h"
   - "Actions for today"
`;

if (isWeekendPrep) {
  instructions += `
5. WEEKEND PLANNING (Thursday/Friday only):
   - Search for Stockholm restaurant recommendations
   - Focus on highly-rated restaurants with good reviews
   - Add a "Weekend Recommendations" section to the Notion page
`;
}

instructions += `
Guidelines:
- Be concise and actionable
- Prioritize important information
- Include links where relevant
`;

// Assemble tools — add search only on weekend planning days
const tools = [GmailMCP, HackerNewsMCP, NotionMCP];
if (isWeekendPrep) {
  tools.push(SearchMCP);
}

const agent = new Agent({
  name: "daily-digest",
  instructions,
  outputSchema: DailyDigestSchema,
  model: "anthropic/claude-sonnet-4-6",
  tools,
  maxIterations: 30,
});

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

console.log("Daily Digest Agent");
console.log("=".repeat(60));
console.log(`Date: ${dateStr} (${dayName})`);
if (isWeekendPrep) {
  console.log("Weekend planning mode: including restaurant recommendations");
}
console.log("\nRunning...\n");

try {
  const result = await agent.run(
    `Create my daily digest for ${dateStr} (${dayName}).` +
      (isWeekendPrep ? " Include Stockholm restaurant recommendations for the weekend." : ""),
  );

  const digest = result.output;
  console.log("=".repeat(60));
  console.log("DAILY DIGEST CREATED");
  console.log("=".repeat(60));
  console.log(`\nDate: ${digest.date}`);
  console.log(`Emails processed: ${digest.emails.length}`);
  console.log(`News items: ${digest.news.length}`);
  console.log(`Action items: ${digest.actions.length}`);
  if (digest.weekend_recommendations) {
    console.log(`Weekend recommendations: ${digest.weekend_recommendations.length}`);
  }
  if (digest.notion_page_created) {
    console.log(`\nNotion page: ${digest.notion_page_url ?? "created"}`);
  }
  console.log(`\nTokens used: ${result.meta.usage.totalTokens}`);
  console.log(`Iterations: ${result.meta.iterations}`);
  console.log(`Tool calls: ${result.meta.toolCalls.length}`);
} catch (error: unknown) {
  const err = error as Error & { cause?: Error & { body?: unknown } };
  console.error(`\nError: ${err.message}`);
  if (err.cause) {
    console.error(`Cause: ${err.cause.message}`);
    if (err.cause.body) console.error("Body:", JSON.stringify(err.cause.body, null, 2));
  }
  console.error("\nTroubleshooting:");
  console.error("  - Verify Composio credentials are valid");
  console.error("  - Check MCP endpoint URLs in .env");
  console.error("  - Ensure OPPER_API_KEY is set");
  console.error("  - Verify connected apps in Composio (Gmail, Notion, etc.)");
  process.exit(1);
}
