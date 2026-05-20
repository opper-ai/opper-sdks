import { BaseClient } from "../client-base.js";
import type { CreateRealtimeSessionRequest, RealtimeSession, RequestOptions } from "../types.js";

/**
 * Client for the model-driven realtime WebSocket endpoint.
 *
 * Two usage patterns:
 *
 *   1. **Server-side**: connect directly to {@link url}() with a Bearer
 *      `Authorization` header (your project API key). Send a `session.start`
 *      event with `config.model` and the rest inline.
 *
 *   2. **Browser-direct**: mint a single-use ticket via
 *      {@link createSession}() on your backend, return only the
 *      `client_secret` to the browser. The browser opens
 *      `new WebSocket(opper.realtime.url(), [\`opper-ticket.${secret}\`])` —
 *      browsers cannot set `Authorization` on a WebSocket constructor, so the
 *      ticket rides in the `Sec-WebSocket-Protocol` subprotocol header.
 *      Fields populated in `config` are bound to the ticket and cannot be
 *      overridden by the browser at `session.start`.
 */
export class RealtimeClient extends BaseClient {
  /**
   * Build the WebSocket URL for `/v3/realtime`.
   *
   * @param opts.ticket - Optional ticket secret. If passed, appended as
   *   `?ticket=<secret>`. Prefer the subprotocol header form in browsers;
   *   pass `ticket` here only for clients that can't set subprotocols.
   */
  url(opts?: { ticket?: string }): string {
    const wsBase = this.baseUrl.replace(/^http/, "ws");
    const path = `${wsBase}/v3/realtime`;
    if (opts?.ticket) {
      return `${path}?ticket=${encodeURIComponent(opts.ticket)}`;
    }
    return path;
  }

  /**
   * Mint a single-use ephemeral ticket for browser-direct WebSocket access.
   * POST /v3/realtime-sessions
   *
   * The returned `client_secret` is what the browser passes via the
   * `opper-ticket.<secret>` subprotocol when opening the WebSocket.
   *
   * @example
   * ```ts
   * const ticket = await opper.realtime.createSession({
   *   config: {
   *     model: "openai/gpt-realtime-2",
   *     voice: "marin",
   *     instructions: "Be concise.",
   *   },
   *   ttl_seconds: 60,
   * });
   * // Hand ticket.client_secret to the browser; never the API key.
   * ```
   */
  async createSession(
    body: CreateRealtimeSessionRequest,
    options?: RequestOptions,
  ): Promise<RealtimeSession> {
    return this._post<RealtimeSession>("/v3/realtime-sessions", body, options);
  }
}
