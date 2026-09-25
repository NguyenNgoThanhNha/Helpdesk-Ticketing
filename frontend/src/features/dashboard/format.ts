const oneDecimal = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat('vi-VN');

/** "4,2 giờ" */
export const fmtHours = (h: number | null | undefined) => (h === null || h === undefined ? '—' : `${oneDecimal.format(h)} giờ`);
/** "82,5%" */
export const fmtPct = (p: number | null | undefined) => (p === null || p === undefined ? '—' : `${oneDecimal.format(p)}%`);
/** "1.234" */
export const fmtInt = (n: number) => integer.format(n);

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

/** Series label of the ticket-count charts. */
export const TICKET_COUNT_LABEL = 'Số ticket';
