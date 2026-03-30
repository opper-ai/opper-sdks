import { describe, expect, it } from "vitest";
import {
  ApiError,
  AuthenticationError,
  BadRequestError,
  InternalServerError,
  NotFoundError,
  RateLimitError,
} from "../types.js";

describe("ApiError", () => {
  it("constructs with status, statusText, and body", () => {
    const error = new ApiError(404, "Not Found", { error: { code: "not_found", message: "not found" } });
    expect(error.status).toBe(404);
    expect(error.statusText).toBe("Not Found");
    expect(error.body).toEqual({ error: { code: "not_found", message: "not found" } });
  });

  it("extends Error", () => {
    const error = new ApiError(500, "Internal Server Error", null);
    expect(error).toBeInstanceOf(Error);
  });

  it("includes API message in error message when available", () => {
    const error = new ApiError(400, "Bad Request", {
      error: { code: "invalid_input", message: "field 'name' is required" },
    });
    expect(error.message).toBe("400 Bad Request: field 'name' is required");
  });

  it("falls back to status text when no structured body", () => {
    const error = new ApiError(401, "Unauthorized", null);
    expect(error.message).toBe("401 Unauthorized");
  });

  it("has name ApiError", () => {
    const error = new ApiError(400, "Bad Request", null);
    expect(error.name).toBe("ApiError");
  });

  it("exposes parsed error detail", () => {
    const error = new ApiError(400, "Bad Request", {
      error: { code: "validation_error", message: "bad input", details: { field: "name" } },
    });
    expect(error.error).toEqual({
      code: "validation_error",
      message: "bad input",
      details: { field: "name" },
    });
  });

  it("returns undefined error detail for non-structured body", () => {
    const error = new ApiError(500, "Internal Server Error", "something broke");
    expect(error.error).toBeUndefined();
  });
});

describe("BadRequestError", () => {
  it("has status 400", () => {
    const error = new BadRequestError("Bad Request", { error: { code: "invalid", message: "bad" } });
    expect(error.status).toBe(400);
    expect(error.name).toBe("BadRequestError");
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(BadRequestError);
  });
});

describe("AuthenticationError", () => {
  it("has status 401", () => {
    const error = new AuthenticationError("Unauthorized", null);
    expect(error.status).toBe(401);
    expect(error.name).toBe("AuthenticationError");
    expect(error).toBeInstanceOf(ApiError);
  });
});

describe("NotFoundError", () => {
  it("has status 404", () => {
    const error = new NotFoundError("Not Found", { error: { code: "not_found", message: "gone" } });
    expect(error.status).toBe(404);
    expect(error.name).toBe("NotFoundError");
    expect(error).toBeInstanceOf(ApiError);
  });
});

describe("RateLimitError", () => {
  it("has status 429", () => {
    const error = new RateLimitError("Too Many Requests", { error: { code: "rate_limit", message: "slow down" } });
    expect(error.status).toBe(429);
    expect(error.name).toBe("RateLimitError");
    expect(error).toBeInstanceOf(ApiError);
  });
});

describe("InternalServerError", () => {
  it("has status 500", () => {
    const error = new InternalServerError("Internal Server Error", null);
    expect(error.status).toBe(500);
    expect(error.name).toBe("InternalServerError");
    expect(error).toBeInstanceOf(ApiError);
  });
});

describe("error hierarchy", () => {
  it("all subclasses can be caught as ApiError", () => {
    const errors = [
      new BadRequestError("Bad Request", null),
      new AuthenticationError("Unauthorized", null),
      new NotFoundError("Not Found", null),
      new RateLimitError("Too Many Requests", null),
      new InternalServerError("Internal Server Error", null),
    ];

    for (const error of errors) {
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toBeInstanceOf(Error);
    }
  });

  it("supports typed catch patterns", () => {
    try {
      throw new RateLimitError("Too Many Requests", { error: { code: "rate_limit", message: "slow down" } });
    } catch (e) {
      if (e instanceof RateLimitError) {
        expect(e.status).toBe(429);
        expect(e.error?.code).toBe("rate_limit");
      } else {
        throw new Error("should have caught as RateLimitError");
      }
    }
  });
});
