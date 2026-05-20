// Realtime — model-driven voice agent over WebSocket
//
// This example demonstrates both patterns the SDK supports for the
// `/v3/realtime` endpoint:
//
//   1. Server-side direct connection (this script): Node opens the WS with a
//      Bearer header and sends `session.start` with the full `config` inline.
//
//   2. Browser-direct via ephemeral ticket (shown but not connected to in
//      this script — see the cookbook's `brainstorm-time` example for a
//      full browser implementation): the server mints a single-use
//      `client_secret` via `opper.realtime.createSession()` and hands only
//      the ticket to the browser. The browser opens the WS carrying the
//      ticket in the `Sec-WebSocket-Protocol: opper-ticket.<secret>`
//      subprotocol header. Browsers cannot set Authorization on
//      `new WebSocket(...)`, so the ticket pattern is how you keep the API
//      key off the client.
//
// Prerequisites:
//   sox installed (`brew install sox` on macOS)
//
// Run with:
//   npx tsx examples/getting-started/11-real-time.ts
//
// Speak naturally — server-side VAD detects when you start and stop.
// Use headphones to avoid echo. Press Ctrl+C to exit.

import { spawn, type ChildProcess } from "node:child_process";
import WebSocket from "ws";
import { Opper } from "../../src/index.js";

const opper = new Opper();

// --- Pattern 2 demo (informational) ----------------------------------------
// In a real browser-direct app, this runs on your backend and you return
// only `client_secret` to the browser. Logged here so you can see the
// response shape; the rest of this script uses Pattern 1.

console.log("Minting an ephemeral ticket (demo)…");
const ticket = await opper.realtime.createSession({
  config: {
    model: "openai/gpt-realtime-2",
    voice: "marin",
    instructions: "You are a friendly assistant. Keep answers short.",
    input_transcription: true,
    output_transcription: true,
    turn_detection: { type: "server_vad", threshold: 0.5, silence_duration_ms: 500 },
  },
  ttl_seconds: 60,
});
console.log(`  client_secret: ${ticket.client_secret.slice(0, 8)}…`);
console.log(`  expires_at:    ${ticket.expires_at}`);
console.log(`  browser opens: new WebSocket("${opper.realtime.url()}", ["opper-ticket.<client_secret>"])\n`);

// --- Pattern 1: server-side direct connection ------------------------------

const wsUrl = opper.realtime.url();
console.log(`Connecting to ${wsUrl}…`);
const ws = new WebSocket(wsUrl, {
  headers: { Authorization: `Bearer ${process.env.OPPER_API_KEY}` },
});

let sampleRate = 24000;
let recorder: ChildProcess | null = null;
let player: ChildProcess | null = null;

function startRecorder() {
  recorder = spawn(
    "sox",
    ["-d", "-t", "raw", "-b", "16", "-e", "signed-integer", "-r", String(sampleRate), "-c", "1", "-"],
    { stdio: ["ignore", "pipe", "ignore"] },
  );
  recorder.stdout!.on("data", (chunk: Buffer) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "audio.append", audio: chunk.toString("base64") }));
    }
  });
  recorder.on("error", (err) => {
    console.error("Recorder error (is sox installed? `brew install sox`):", err.message);
    process.exit(1);
  });
}

function startPlayer() {
  player = spawn(
    "sox",
    ["-t", "raw", "-b", "16", "-e", "signed-integer", "-r", String(sampleRate), "-c", "1", "-", "-d"],
    { stdio: ["pipe", "ignore", "ignore"] },
  );
  player.on("error", (err) => console.error("Player error:", err.message));
}

ws.on("open", () => {
  console.log("WebSocket connected, starting session…");
  // For a server-side direct connection we send the full session config
  // inline. (For browser-direct via ticket, the config is already bound
  // to the ticket and `session.start` is sent with `config: {}`.)
  ws.send(
    JSON.stringify({
      type: "session.start",
      config: {
        model: "openai/gpt-realtime-2",
        voice: "marin",
        instructions: "You are a friendly assistant. Keep answers short and conversational.",
        input_transcription: true,
        output_transcription: true,
        turn_detection: { type: "server_vad", threshold: 0.5, silence_duration_ms: 500 },
      },
    }),
  );
});

ws.on("message", (data: Buffer) => {
  const event = JSON.parse(data.toString());
  switch (event.type) {
    case "session.started":
      sampleRate = event.input_sample_rate || event.sample_rate || 24000;
      console.log(`Session started (rate: ${sampleRate})`);
      console.log("Speak into your microphone… (Ctrl+C to exit)\n");
      startRecorder();
      startPlayer();
      break;
    case "audio.delta":
      if (player?.stdin?.writable && event.audio) {
        player.stdin.write(Buffer.from(event.audio, "base64"));
      }
      break;
    case "text.delta":
      process.stdout.write(event.delta || "");
      break;
    case "transcript.committed":
      console.log(`\nYou: ${event.transcript}`);
      process.stdout.write("Agent: ");
      break;
    case "response.completed":
    case "response.done":
      console.log();
      break;
    case "error":
      console.error("\nError:", event.error?.message || event.error);
      break;
  }
});

ws.on("error", (err) => console.error("WebSocket error:", err.message));
ws.on("close", () => {
  console.log("\nSession ended.");
  cleanup();
});

function cleanup() {
  recorder?.kill();
  player?.stdin?.end();
  player?.kill();
  if (ws.readyState === WebSocket.OPEN) ws.close();
}

process.on("SIGINT", () => {
  console.log("\n\nExiting…");
  cleanup();
  setTimeout(() => process.exit(0), 500);
});
