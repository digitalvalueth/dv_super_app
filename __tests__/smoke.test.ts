import { describe, expect, it } from "vitest";

// Smoke test: confirms the Vitest runner + config work in the mobile app.
// Real pure-logic tests live next to the modules they cover (services/**, utils/**).
describe("vitest smoke (mobile)", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
