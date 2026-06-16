// Pure aggregation for the personal Daily-Sale dashboard. No React/Firebase —
// runs in node-env Vitest. The screen fetches DailySale[] and feeds the lite
// shape here to compute the cards, the chart series and the comparisons.

export interface DailySaleLite {
  saleDate: string; // "YYYY-MM-DD"
  totalRevenue: number;
  totalItems: number;
}

export interface DayPoint {
  date: string;
  revenue: number;
  items: number;
}

export interface DashboardStats {
  today: DayPoint;
  yesterday: DayPoint;
  /** % change today vs yesterday; null when yesterday had no sales. */
  todayVsYesterdayPct: number | null;
  week: { revenue: number; items: number }; // last 7 days incl. today
  prevWeek: { revenue: number }; // the 7 days before that
  weekVsPrevPct: number | null;
  month: { revenue: number; items: number }; // current calendar month
  series: DayPoint[]; // last `seriesDays` days, oldest → today
  bestDay: DayPoint | null; // best day within the series
  avgPerActiveDay: number; // avg revenue over days-with-sales in the last 7
  totalTx: number; // number of sale documents in the input
}

/** Add `n` days to a "YYYY-MM-DD" string (UTC, TZ-safe). */
export function addDays(dateStr: string, n: number): string {
  const t = new Date(`${dateStr}T00:00:00Z`).getTime() + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

const pct = (cur: number, prev: number): number | null =>
  prev > 0 ? ((cur - prev) / prev) * 100 : null;

export function buildDashboardStats(
  sales: DailySaleLite[],
  todayStr: string,
  seriesDays = 14,
): DashboardStats {
  const byDate = new Map<string, { revenue: number; items: number }>();
  for (const s of sales) {
    const e = byDate.get(s.saleDate) ?? { revenue: 0, items: 0 };
    e.revenue += s.totalRevenue || 0;
    e.items += s.totalItems || 0;
    byDate.set(s.saleDate, e);
  }
  const at = (d: string): DayPoint => ({
    date: d,
    revenue: byDate.get(d)?.revenue ?? 0,
    items: byDate.get(d)?.items ?? 0,
  });

  const today = at(todayStr);
  const yesterday = at(addDays(todayStr, -1));

  // Sum a [start, end] inclusive window of days.
  const sumWindow = (fromOffset: number, toOffset: number) => {
    let revenue = 0;
    let items = 0;
    let activeDays = 0;
    for (let i = fromOffset; i <= toOffset; i++) {
      const p = at(addDays(todayStr, -i));
      revenue += p.revenue;
      items += p.items;
      if (p.revenue > 0) activeDays++;
    }
    return { revenue, items, activeDays };
  };

  const w = sumWindow(0, 6); // last 7 days incl today
  const pw = sumWindow(7, 13); // previous 7 days

  // Current calendar month (by "YYYY-MM" prefix).
  const monthPrefix = todayStr.slice(0, 7);
  let monthRev = 0;
  let monthItems = 0;
  for (const [d, e] of byDate) {
    if (d.slice(0, 7) === monthPrefix) {
      monthRev += e.revenue;
      monthItems += e.items;
    }
  }

  const series: DayPoint[] = [];
  for (let i = seriesDays - 1; i >= 0; i--) series.push(at(addDays(todayStr, -i)));

  let bestDay: DayPoint | null = null;
  for (const p of series) {
    if (p.revenue > 0 && (!bestDay || p.revenue > bestDay.revenue)) bestDay = p;
  }

  return {
    today,
    yesterday,
    todayVsYesterdayPct: pct(today.revenue, yesterday.revenue),
    week: { revenue: w.revenue, items: w.items },
    prevWeek: { revenue: pw.revenue },
    weekVsPrevPct: pct(w.revenue, pw.revenue),
    month: { revenue: monthRev, items: monthItems },
    series,
    bestDay,
    avgPerActiveDay: w.activeDays > 0 ? w.revenue / w.activeDays : 0,
    totalTx: sales.length,
  };
}
