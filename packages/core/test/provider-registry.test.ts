import { describe, expect, it } from "vitest";
import { ProviderRegistry } from "../src/ai/provider-registry.js";

describe("ProviderRegistry", () => {
  it("registers and retrieves providers by id", () => {
    const registry = new ProviderRegistry<{ id: string; label: string }>();
    const provider = { id: "custom", label: "My provider" };

    registry.register(provider);

    expect(registry.get("custom")).toEqual(provider);
    expect(registry.list()).toEqual([provider]);
  });

  it("rejects duplicate provider ids", () => {
    const registry = new ProviderRegistry<{ id: string }>();
    registry.register({ id: "openai" });

    expect(() => registry.register({ id: "openai" })).toThrow(/already registered/);
  });
});
