// =============================================================================
// SSE test helpers
// =============================================================================
//
// Convert an ORResponse into an SSE-formatted mock Response, so tests written
// against the old non-streaming JSON path keep working now that Agent.run()
// drives the streaming loop internally.

import type {
  ORFunctionCallOutputItemResponse,
  ORMessageOutputItem,
  ORResponse,
  ORStreamEvent,
} from "../../agent/types.js";

/** Render an array of ORStreamEvent objects as SSE wire bytes. */
export function sseChunk(events: ORStreamEvent[]): string {
  return events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
}

/** Build a Response-like object backed by a ReadableStream of SSE bytes. */
export function mockSSEResponse(events: ORStreamEvent[]): Response {
  const payload = new TextEncoder().encode(sseChunk(events));
  let yielded = false;

  const stream = new ReadableStream({
    pull(controller) {
      if (!yielded) {
        controller.enqueue(payload);
        yielded = true;
      } else {
        controller.close();
      }
    },
  });

  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers({ "content-type": "text/event-stream" }),
    body: stream,
  } as unknown as Response;
}

/**
 * Convert a finalised ORResponse into the SSE event sequence the server would
 * have streamed to produce it. Output items are walked in order so each
 * function_call gets `output_item.added` + a single `function_call_arguments.done`,
 * and each assistant message text gets a single `output_text.delta`.
 *
 * Terminates with `response.completed` unless `response.error` is set, in which
 * case it terminates with `response.failed`.
 */
export function responseToSSE(response: ORResponse): ORStreamEvent[] {
  const events: ORStreamEvent[] = [];
  events.push({ type: "response.created", response });

  response.output.forEach((item, index) => {
    if (item.type === "function_call") {
      const fc = item as ORFunctionCallOutputItemResponse;
      events.push({
        type: "response.output_item.added",
        output_index: index,
        item: {
          type: "function_call",
          id: fc.id,
          call_id: fc.call_id,
          name: fc.name,
          arguments: "",
          status: "in_progress",
        },
      });
      events.push({
        type: "response.function_call_arguments.done",
        output_index: index,
        call_id: fc.call_id,
        arguments: fc.arguments,
      });
    } else if (item.type === "message" && item.role === "assistant") {
      const msg = item as ORMessageOutputItem;
      msg.content.forEach((part, contentIndex) => {
        if (part.type === "output_text" && part.text) {
          events.push({
            type: "response.output_text.delta",
            output_index: index,
            content_index: contentIndex,
            delta: part.text,
          });
          events.push({
            type: "response.output_text.done",
            output_index: index,
            content_index: contentIndex,
            text: part.text,
          });
        }
      });
    } else if (item.type === "reasoning") {
      const summaryParts = item.summary ?? [];
      for (const summary of summaryParts) {
        if (summary.type === "summary_text" && summary.text) {
          events.push({
            type: "response.reasoning_summary_text.delta",
            output_index: index,
            delta: summary.text,
          });
          events.push({
            type: "response.reasoning_summary_text.done",
            output_index: index,
            text: summary.text,
          });
        }
      }
    }
  });

  if (response.error) {
    events.push({ type: "response.failed", response });
  } else {
    events.push({ type: "response.completed", response });
  }

  return events;
}

/** Convenience: build an SSE mock Response directly from an ORResponse. */
export function mockSSEResponseFromOR(response: ORResponse): Response {
  return mockSSEResponse(responseToSSE(response));
}
