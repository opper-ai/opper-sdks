// Realtime voice agent: bidirectional audio streaming via WebSocket
// Requires: sox installed (`brew install sox` on macOS)
//
// This example creates a voice agent, connects via WebSocket, and streams
// microphone audio to the agent while playing back its audio responses.
// Speak naturally — the server detects when you start and stop talking.
// Use headphones to avoid echo. Press Ctrl+C to exit.

import { spawn, type ChildProcess } from "node:child_process";
import { Opper } from "../../src/index.js";
import WebSocket from "ws";

const opper = new Opper();

// ── 1. Create the realtime voice agent ──────────────────────────────────────

console.log("Creating voice agent...");
const agent = await opper.functions.createRealtime("sdk-test-voice-agent", {
  instructions: "You are a friendly assistant. Keep your answers short and conversational.",
});
console.log("Agent ready (cached:", agent.cached + ")");

// ── 2. Connect WebSocket ────────────────────────────────────────────────────

const wsUrl = opper.functions.getRealtimeWebSocketUrl("sdk-test-voice-agent");
const ws = new WebSocket(wsUrl, {
  headers: { Authorization: `Bearer ${process.env.OPPER_API_KEY}` },
});

let sampleRate = 24000;
let recorder: ChildProcess | null = null;
let player: ChildProcess | null = null;

function startRecorder() {
  // Capture mic → raw PCM16 LE mono at the server's sample rate
  recorder = spawn("sox", [
    "-d", "-t", "raw", "-b", "16", "-e", "signed-integer",
    "-r", String(sampleRate), "-c", "1", "-",
  ], { stdio: ["ignore", "pipe", "ignore"] });

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
  player = spawn("sox", [
    "-t", "raw", "-b", "16", "-e", "signed-integer",
    "-r", String(sampleRate), "-c", "1", "-", "-d",
  ], { stdio: ["pipe", "ignore", "ignore"] });

  player.on("error", (err) => {
    console.error("Player error:", err.message);
  });
}

// ── 3. Handle WebSocket events ──────────────────────────────────────────────

ws.on("open", () => {
  console.log("WebSocket connected, starting session...");
  ws.send(JSON.stringify({ type: "session.start" }));
});

ws.on("message", (data: Buffer) => {
  const event = JSON.parse(data.toString());

  switch (event.type) {
    case "session.started":
      sampleRate = event.sample_rate || 24000;
      console.log(`Session started (rate: ${sampleRate}, format: ${event.audio_format || "pcm16"})`);
      console.log("Speak into your microphone... (Ctrl+C to exit)\n");
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

    case "speech.started":
      process.stdout.write("\n[listening...] ");
      break;

    case "speech.stopped":
      process.stdout.write("\n[thinking...] ");
      break;

    case "transcript.committed":
      console.log(`\nYou: ${event.transcript}`);
      process.stdout.write("Agent: ");
      break;

    case "response.completed":
      console.log();
      break;

    case "tool.call":
      console.log(`\n[tool call: ${event.tool_name}(${JSON.stringify(event.tool_arguments)})]`);
      ws.send(JSON.stringify({
        type: "tool.result",
        tool_call_id: event.tool_call_id,
        tool_result: { result: "Tool result placeholder" },
      }));
      break;

    case "error":
      console.error("\nError:", event.error?.message || event.error);
      break;
  }
});

ws.on("error", (err) => console.error("WebSocket error:", err.message));
ws.on("close", () => { console.log("\nSession ended."); cleanup(); });

// ── 4. Cleanup on exit ──────────────────────────────────────────────────────

function cleanup() {
  recorder?.kill();
  player?.stdin?.end();
  player?.kill();
  if (ws.readyState === WebSocket.OPEN) ws.close();
  opper.functions.delete("sdk-test-voice-agent").catch(() => {});
}

process.on("SIGINT", () => {
  console.log("\n\nExiting...");
  cleanup();
  setTimeout(() => process.exit(0), 500);
});
