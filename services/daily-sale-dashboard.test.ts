import { describe, expect, it } from "vitest";
import {
  addDays,
  buildDashboardStats,
  type DailySaleLite,
} from "./daily-sale-dashboard";

const TODAY = "2026-06-16";
const S = (saleDate: string, totalRevenue: number, totalItems = 1): DailySaleLite => ({
  saleDate,
  totalRevenue,
  totalItems,
});

describe("addDays", () => {
  it("adds/subtracts days TZ-safely across month boundaries", () => {
    expect(addDays("2026-06-16", -1)).toBe("2026-06-15");
    expect(addDays("2026-06-01", -1)).toBe("2026-05-31");
    expect(addDays("2026-06-16", 1)).toBe("2026-06-17");
  });
});

describe("buildDashboardStats", () => {
  it("aggregates today/yesterday and the comparison %", () => {
    const r = buildDashboardStats([S(TODAY, 1000), S(addDays(TODAY, -1), 500)], TODAY);
    expect(r.today.revenue).toBe(1000);
    expect(r.yesterday.revenue).toBe(500);
    expect(r.todayVsYesterdayPct).toBe(100); // +100%
  });

  it("sums duplicate same-day docs and counts transactions", () => {
    const r = buildDashboardStats([S(TODAY, 300, 2), S(TODAY, 200, 1)], TODAY);
    expect(r.today.revenue).toBe(500);
    expect(r.today.items).toBe(3);
    expect(r.totalTx).toBe(2);
  });

  it("computes last-7 vs previous-7 windows", () => {
    const sales = [
      S(TODAY, 100),
      S(addDays(TODAY, -3), 100), // within last 7
      S(addDays(TODAY, -8), 400), // within previous 7
    ];
    const r = buildDashboardStats(sales, TODAY);
    expect(r.week.revenue).toBe(200);
    expect(r.prevWeek.revenue).toBe(400);
    expect(r.weekVsPrevPct).toBe(-50);
  });

  it("returns null comparison when the prior period is empty", () => {
    const r = buildDashboardStats([S(TODAY, 100)], TODAY);
    expect(r.todayVsYesterdayPct).toBeNull();
    expect(r.weekVsPrevPct).toBeNull();
  });

  it("builds a continuous series ending today and finds the best day", () => {
    const r = buildDashboardStats([S(TODAY, 100), S(addDays(TODAY, -2), 900)], TODAY, 7);
    expect(r.series).toHaveLength(7);
    expect(r.series[r.series.length - 1].date).toBe(TODAY);
    expect(r.series[0].date).toBe(addDays(TODAY, -6));
    expect(r.bestDay?.date).toBe(addDays(TODAY, -2));
    expect(r.bestDay?.revenue).toBe(900);
  });

  it("avg per active day ignores zero-sale days", () => {
    const r = buildDashboardStats([S(TODAY, 300), S(addDays(TODAY, -1), 100)], TODAY);
    expect(r.avgPerActiveDay).toBe(200); // (300+100)/2 active days
  });

  it("month total uses the current calendar month only", () => {
    const r = buildDashboardStats(
      [S("2026-06-02", 100), S("2026-06-15", 50), S("2026-05-31", 999)],
      TODAY,
    );
    expect(r.month.revenue).toBe(150);
  });

  it("handles an empty input", () => {
    const r = buildDashboardStats([], TODAY);
    expect(r.today.revenue).toBe(0);
    expect(r.bestDay).toBeNull();
    expect(r.avgPerActiveDay).toBe(0);
    expect(r.series).toHaveLength(14);
  });
});
