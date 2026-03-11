// Realtime WebSocket URL generation
import { Opper } from "../../src/index.js";

const client = new Opper();

// Get the WebSocket URL for a realtime voice agent
const wsUrl = client.functions.getRealtimeWebSocketUrl("my-voice-agent");
console.log("WebSocket URL:", wsUrl);

// Health check to verify connectivity
const health = await client.system.healthCheck();
console.log("Server status:", health.status);
