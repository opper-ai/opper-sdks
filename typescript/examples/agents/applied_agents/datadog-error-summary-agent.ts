/**
 * Datadog Error Summary Agent — Datadog MCP server, env-key authenticated.
 *
 * Multi-step agent that surveys the last 2 hours of error logs across all
 * services in Datadog and produces a structured summary: total count, plus a
 * short blurb per distinct error.
 *
 * What this demonstrates:
 *   - Wiring an external MCP server to the opperai Agent via streamable HTTP.
 *   - Authenticating that MCP via static env-var headers (the Claude-Code
 *     pattern), not OAuth.
 *   - Driving a multi-step investigation: aggregate counts, sample raw entries,
 *     group by service, summarize each.
 *
 * Prerequisites:
 *   - OPPER_API_KEY in .env
 *   - DATADOG_API_KEY in .env (organization API key)
 *   - DATADOG_APP_KEY in .env (user application key with MCP read scopes)
 *   - Optional DATADOG_SITE in .env — defaults to datadoghq.eu. Other values:
 *     datadoghq.com (US1), us3.datadoghq.com, us5.datadoghq.com, ap1.datadoghq.com
 *
 * Run with:
 *   cd typescript
 *   node --env-file=../.env node_modules/.bin/tsx \
 *     examples/agents/applied_agents/datadog-error-summary-agent.ts
 */

import { z } from "zod";
import { Agent, mcp } from "../../../src/index.js";
import type { Hooks } from "../../../src/index.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const ErrorEntrySchema = z.object({
  service: z.string().describe("Service that emitted the error, or 'unknown'"),
  error_type: z
    .string()
    .describe("Short label for the error class (exception, status, etc.)"),
  count: z.number().int().describe("Number of occurrences in the time window"),
  summary: z.string().describe("One-sentence summary of what the error looks like"),
  first_seen: z.string().nullable().optional().describe("ISO 8601 of earliest occurrence"),
  last_seen: z.string().nullable().optional().describe("ISO 8601 of most recent occurrence"),
});

const ErrorReportSchema = z.object({
  time_window_hours: z.number().int().describe("Window analyzed, in hours"),
  total_errors: z.number().int().describe("Total error count across all services"),
  distinct_errors: z.number().int().describe("Number of distinct error classes"),
  services_affected: z.array(z.string()).describe("Services with at least one error"),
  errors: z.array(ErrorEntrySchema).describe("Per-error-class breakdown"),
  headline: z.string().describe("One-line takeaway suitable for a Slack post"),
});

// ---------------------------------------------------------------------------
// MCP wiring — Datadog hosted MCP server, auth via env-var headers
// ---------------------------------------------------------------------------

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    console.error(
      `Missing ${key} in environment. See the comment block at the top of this file.`,
    );
    process.exit(1);
  }
  return value;
}

const datadogApiKey = requireEnv("DATADOG_API_KEY");
const datadogAppKey = requireEnv("DATADOG_APP_KEY");
const datadogSite = process.env.DATADOG_SITE ?? "datadoghq.eu";

const datadogMCP = mcp({
  name: "datadog",
  transport: "streamable-http",
  url: `https://mcp.${datadogSite}/api/unstable/mcp-server/mcp`,
  headers: {
    DD_API_KEY: datadogApiKey,
    DD_APPLICATION_KEY: datadogAppKey,
  },
});

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

const WINDOW_HOURS = 2;

const instructions = `
You are a site-reliability assistant. Produce a concise report of all error
logs from the last ${WINDOW_HOURS} hours across every service in Datadog.

Workflow:
1. Use the Datadog log analysis tool to count total error-level logs in the
   last ${WINDOW_HOURS} hours, grouped by service.
2. For each service with errors, sample a handful of representative log
   entries (status:error) to identify the distinct error classes.
3. For each distinct error class, count occurrences and capture a short
   one-sentence summary plus first_seen and last_seen timestamps.
4. Produce a headline that captures the top 1-2 issues — something a humans
   can paste into Slack.

Guidelines:
- Prefer aggregation tools over fetching thousands of raw logs.
- If there are no errors, return an empty report with a "all clear" headline.
- Be deterministic about the time window: end at "now", start at "now minus ${WINDOW_HOURS}h".
`.trim();

const hooks: Hooks = {
  onIterationStart: ({ iteration }) => {
    console.log(`\n--- Iteration ${iteration} ---`);
  },
  onToolStart: ({ name, input }) => {
    const s = JSON.stringify(input);
    console.log(`  -> ${name}(${s.slice(0, 140)}${s.length > 140 ? "..." : ""})`);
  },
  onToolEnd: ({ name, output, error, durationMs }) => {
    if (error) {
      console.log(`  x ${name} failed (${durationMs}ms): ${error}`);
    } else {
      const s = JSON.stringify(output);
      console.log(`  <- ${name} (${durationMs}ms): ${s.slice(0, 160)}${s.length > 160 ? "..." : ""}`);
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
  name: "datadog-error-summary",
  instructions,
  outputSchema: ErrorReportSchema,
  model: "anthropic/claude-sonnet-4-6",
  tools: [datadogMCP],
  maxIterations: 20,
  hooks,
});

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

requireEnv("OPPER_API_KEY");

const now = new Date().toISOString().replace(/\.\d{3}Z$/, "");
console.log("Datadog Error Summary Agent");
console.log("=".repeat(60));
console.log(`Now: ${now}`);
console.log(`Window: last ${WINDOW_HOURS} hours`);
console.log(`Site: ${datadogSite}\n`);
console.log("Running...\n");

try {
  const result = await agent.run(
    `Summarize all error logs from the last ${WINDOW_HOURS} hours.`,
  );
  const report = result.output;
  console.log("=".repeat(60));
  console.log("ERROR SUMMARY");
  console.log("=".repeat(60));
  console.log(`\nHeadline: ${report.headline}`);
  console.log(`\nTotal errors:    ${report.total_errors}`);
  console.log(`Distinct errors: ${report.distinct_errors}`);
  console.log(
    `Services hit:    ${report.services_affected.join(", ") || "(none)"}`,
  );
  if (report.errors.length) {
    console.log("\nBreakdown:");
    for (const e of report.errors) {
      console.log(`  [${String(e.count).padStart(4, " ")}] ${e.service} :: ${e.error_type}`);
      console.log(`         ${e.summary}`);
      if (e.first_seen || e.last_seen) {
        console.log(`         first=${e.first_seen} last=${e.last_seen}`);
      }
    }
  }
  console.log(`\nTokens used: ${result.meta.usage.totalTokens}`);
  console.log(`Iterations:  ${result.meta.iterations}`);
  console.log(`Tool calls:  ${result.meta.toolCalls.length}`);
} catch (error: unknown) {
  const err = error as Error & { cause?: Error & { body?: unknown } };
  console.error(`\nError: ${err.message}`);
  if (err.cause) {
    console.error(`Cause: ${err.cause.message}`);
    if (err.cause.body) console.error("Body:", JSON.stringify(err.cause.body, null, 2));
  }
  process.exit(1);
}
