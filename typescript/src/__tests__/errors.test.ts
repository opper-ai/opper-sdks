import { describe, expect, it } from "vitest";
import { ApiError } from "../types.js";

describe("ApiError", () => {
  it("constructs with status, statusText, and body", () => {
    const error = new ApiError(404, "Not Found", { error: { message: "not found" } });
    expect(error.status).toBe(404);
    expect(error.statusText).toBe("Not Found");
    expect(error.body).toEqual({ error: { message: "not found" } });
  });

  it("extends Error", () => {
    const error = new ApiError(500, "Internal Server Error", null);
    expect(error).toBeInstanceOf(Error);
  });

  it("has descriptive message", () => {
    const error = new ApiError(401, "Unauthorized", null);
    expect(error.message).toBe("API Error 401: Unauthorized");
  });

  it("has name ApiError", () => {
    const error = new ApiError(400, "Bad Request", null);
    expect(error.name).toBe("ApiError");
  });

  it("can be caught as Error", () => {
    try {
      throw new ApiError(429, "Too Many Requests", { retry_after: 30 });
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect(e).toBeInstanceOf(ApiError);
      if (e instanceof ApiError) {
        expect(e.status).toBe(429);
      }
    }
  });
});
