import { describe, it, expect } from "vitest";
import { previousPeriodRange, growthPercent } from "./period";

describe("previousPeriodRange", () => {
  it("returns empty bounds when either date is missing", () => {
    expect(previousPeriodRange("", "2026-06-10")).toEqual({
      prevStart: "",
      prevEnd: "",
    });
    expect(previousPeriodRange("2026-06-10", "")).toEqual({
      prevStart: "",
      prevEnd: "",
    });
    expect(previousPeriodRange("", "")).toEqual({ prevStart: "", prevEnd: "" });
  });

  it("computes the preceding 1-day window (same day range)", () => {
    // [2026-06-10, 2026-06-10] is 1 day -> previous is just the day before.
    expect(previousPeriodRange("2026-06-10", "2026-06-10")).toEqual({
      prevStart: "2026-06-09",
      prevEnd: "2026-06-09",
    });
  });

  it("computes the preceding 7-day window", () => {
    // [2026-06-04 .. 2026-06-10] = 7 days. Previous = [2026-05-28 .. 2026-06-03].
    expect(previousPeriodRange("2026-06-04", "2026-06-10")).toEqual({
      prevStart: "2026-05-28",
      prevEnd: "2026-06-03",
    });
  });

  it("computes the preceding window for a full month range", () => {
    // June (30 days). Previous window ends 2026-05-31 and spans 30 days back.
    expect(previousPeriodRange("2026-06-01", "2026-06-30")).toEqual({
      prevStart: "2026-05-02",
      prevEnd: "2026-05-31",
    });
  });

  it("crosses month + year boundaries correctly", () => {
    // [2026-01-01 .. 2026-01-03] = 3 days. Previous = [2025-12-29 .. 2025-12-31].
    expect(previousPeriodRange("2026-01-01", "2026-01-03")).toEqual({
      prevStart: "2025-12-29",
      prevEnd: "2025-12-31",
    });
  });

  it("handles a range spanning a leap-day February", () => {
    // 2024 is a leap year: [2024-03-01 .. 2024-03-05] = 5 days.
    // Previous = [2024-02-25 .. 2024-02-29] (Feb has 29 days).
    expect(previousPeriodRange("2024-03-01", "2024-03-05")).toEqual({
      prevStart: "2024-02-25",
      prevEnd: "2024-02-29",
    });
  });
});

describe("growthPercent", () => {
  it("computes positive growth", () => {
    expect(growthPercent(150, 100)).toBeCloseTo(50, 6);
  });

  it("computes negative growth", () => {
    expect(growthPercent(80, 100)).toBeCloseTo(-20, 6);
  });

  it("returns 0 (no division) when previous is 0", () => {
    expect(growthPercent(100, 0)).toBe(0);
  });

  it("returns 0 when previous is negative (guard uses > 0)", () => {
    expect(growthPercent(100, -50)).toBe(0);
  });

  it("returns 0 growth when current equals previous", () => {
    expect(growthPercent(100, 100)).toBe(0);
  });
});
