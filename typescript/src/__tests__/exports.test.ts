import { describe, expect, it } from "vitest";
import * as sdk from "../index.js";

describe("Public API surface", () => {
  it("exports Opper class", () => {
    expect(sdk.Opper).toBeDefined();
    expect(typeof sdk.Opper).toBe("function");
  });

  it("exports ApiError class", () => {
    expect(sdk.ApiError).toBeDefined();
    expect(typeof sdk.ApiError).toBe("function");
  });

  it("exports all sub-client classes", () => {
    expect(sdk.FunctionsClient).toBeDefined();
    expect(sdk.ModelsClient).toBeDefined();
    expect(sdk.EmbeddingsClient).toBeDefined();
    expect(sdk.GenerationsClient).toBeDefined();
    expect(sdk.SystemClient).toBeDefined();
    expect(sdk.SpansClient).toBeDefined();
    expect(sdk.BaseClient).toBeDefined();
  });
});
