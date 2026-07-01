import { describe, expect, it } from "vitest";

// Smoke test: confirms the Vitest runner + config work in platform-web.
// Replace/extend with real pure-logic tests under lib/**, hooks/**, etc.
describe("vitest smoke (platform-web)", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
