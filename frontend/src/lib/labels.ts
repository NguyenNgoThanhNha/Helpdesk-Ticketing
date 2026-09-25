import type { SlaState, TicketPriority, TicketStatus } from '@/types';

/**
 * Vietnamese labels for the enum values the API returns (the values themselves stay as sent by the API).
 * Shared by several features (tickets, dashboard, settings), hence in `lib/`.
 */
export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  New: 'Mới',
  Open: 'Đang mở',
  InProgress: 'Đang xử lý',
  Pending: 'Chờ phản hồi',
  Resolved: 'Đã giải quyết',
  Closed: 'Đã đóng',
};

export const TICKET_PRIORITY_LABEL: Record<TicketPriority, string> = {
  Low: 'Thấp',
  Medium: 'Trung bình',
  High: 'Cao',
  Urgent: 'Khẩn cấp',
};

export const SLA_STATE_LABEL: Record<SlaState, string> = {
  OnTrack: 'Còn hạn',
  AtRisk: 'Sắp hết hạn',
  Breached: 'Quá hạn',
  Met: 'Đạt SLA',
};

/** Tolerant lookups: unknown values (e.g. a new enum member, or free text in history) are shown as-is. */
const lookup =
  <K extends string>(map: Record<K, string>) =>
  (value: string | null | undefined): string =>
    value == null ? '—' : (map[value as K] ?? value);

export const statusLabel = lookup(TICKET_STATUS_LABEL);
export const priorityLabel = lookup(TICKET_PRIORITY_LABEL);
export const slaStateLabel = lookup(SLA_STATE_LABEL);
