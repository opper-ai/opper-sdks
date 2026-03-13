// Realtime WebSocket URL generation
import { Opper } from "../../src/index.js";

const opper = new Opper();

// Get the WebSocket URL for a realtime voice agent
const wsUrl = opper.functions.getRealtimeWebSocketUrl("my-voice-agent");
console.log("WebSocket URL:", wsUrl);

// Health check to verify connectivity
const health = await opper.system.healthCheck();
console.log("Server status:", health.status);
