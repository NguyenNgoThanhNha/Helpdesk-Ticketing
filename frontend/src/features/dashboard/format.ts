export const fmtHours = (h: number | null | undefined) => (h === null || h === undefined ? '—' : `${h.toFixed(1)}h`);
export const fmtPct = (p: number | null | undefined) => (p === null || p === undefined ? '—' : `${p.toFixed(1)}%`);

/** Status colors for charts (match the status badges). */
export const STATUS_CHART_COLORS: Record<string, string> = {
  New: 'oklch(0.623 0.214 259.815)',
  Open: 'oklch(0.715 0.143 215.221)',
  InProgress: 'oklch(0.585 0.233 277.117)',
  Pending: 'oklch(0.627 0.265 303.9)',
  Resolved: 'oklch(0.696 0.17 162.48)',
  Closed: 'oklch(0.705 0.015 286.067)',
};

export const FALLBACK_CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];
