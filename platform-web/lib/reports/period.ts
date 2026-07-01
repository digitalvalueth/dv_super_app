// Pure date-window + growth helpers shared by the by-store / by-product reports.
// No next/react/firebase imports — only plain Date math.

const formatDateToYmd = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export interface PeriodRange {
  prevStart: string;
  prevEnd: string;
}

/**
 * Compute the immediately-preceding, equal-length window for a given
 * inclusive [startDate, endDate] range (both "YYYY-MM-DD").
 *
 * Mirrors the `prevWindow` useMemo in the by-store / by-product pages:
 * the previous window ends the day before `startDate` and spans the same
 * number of days as the current window. Returns empty strings if either
 * bound is missing.
 */
export function previousPeriodRange(
  startDate: string,
  endDate: string,
): PeriodRange {
  if (!startDate || !endDate) return { prevStart: "", prevEnd: "" };
  const s = new Date(startDate + "T00:00:00");
  const e = new Date(endDate + "T00:00:00");
  const days = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  const prevEnd = new Date(s);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (days - 1));
  return {
    prevStart: formatDateToYmd(prevStart),
    prevEnd: formatDateToYmd(prevEnd),
  };
}

/**
 * Growth percentage of `current` vs `previous`, guarded against div-by-zero.
 * When `previous` is 0 (or negative) the growth is reported as 0, matching
 * the `e.revenuePrev > 0 ? ... : 0` guard used in the pages.
 */
export function growthPercent(current: number, previous: number): number {
  return previous > 0 ? ((current - previous) / previous) * 100 : 0;
}
