import { SLA_STATE_LABEL, TICKET_PRIORITY_LABEL, TICKET_STATUS_LABEL } from '@/lib/labels';
import type { SlaState, TicketPriority, TicketStatus } from '@/types';

/** Labels of ticket fields (list columns, filters, detail header / info card). */
export const TICKET_FIELD_LABEL = {
  id: 'ID',
  title: 'Tiêu đề',
  status: 'Trạng thái',
  priority: 'Ưu tiên',
  category: 'Danh mục',
  assignee: 'Người xử lý',
  requester: 'Người yêu cầu',
  createdBy: 'Người tạo',
  createdAt: 'Ngày tạo',
  sla: 'SLA',
  responseDueAt: 'Phản hồi trước',
  resolvedAt: 'Giải quyết lúc',
  closedAt: 'Đóng lúc',
} as const;

export const STATUS_META: Record<TicketStatus, { label: string; className: string; dot: string }> = {
  New: {
    label: TICKET_STATUS_LABEL.New,
    className: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300',
    dot: 'bg-blue-500',
  },
  Open: {
    label: TICKET_STATUS_LABEL.Open,
    className: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950 dark:text-cyan-300',
    dot: 'bg-cyan-500',
  },
  InProgress: {
    label: TICKET_STATUS_LABEL.InProgress,
    className:
      'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300',
    dot: 'bg-indigo-500',
  },
  Pending: {
    label: TICKET_STATUS_LABEL.Pending,
    className:
      'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950 dark:text-purple-300',
    dot: 'bg-purple-500',
  },
  Resolved: {
    label: TICKET_STATUS_LABEL.Resolved,
    className:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  Closed: {
    label: TICKET_STATUS_LABEL.Closed,
    className: 'border-border bg-muted text-muted-foreground',
    dot: 'bg-zinc-400',
  },
};

export const PRIORITY_META: Record<TicketPriority, { label: string; className: string }> = {
  Urgent: {
    label: TICKET_PRIORITY_LABEL.Urgent,
    className: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300',
  },
  High: {
    label: TICKET_PRIORITY_LABEL.High,
    className:
      'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300',
  },
  Medium: {
    label: TICKET_PRIORITY_LABEL.Medium,
    className:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
  },
  Low: { label: TICKET_PRIORITY_LABEL.Low, className: 'border-border bg-muted text-muted-foreground' },
};

export const SLA_META: Record<SlaState, { label: string; className: string }> = {
  OnTrack: { label: SLA_STATE_LABEL.OnTrack, className: 'text-emerald-700 dark:text-emerald-400' },
  AtRisk: { label: SLA_STATE_LABEL.AtRisk, className: 'text-orange-700 dark:text-orange-400' },
  Breached: { label: SLA_STATE_LABEL.Breached, className: 'text-red-600 dark:text-red-400' },
  Met: { label: SLA_STATE_LABEL.Met, className: 'text-muted-foreground' },
};

/** Search box hint (matches the API search semantics: `#123` = exact id, accent / case-insensitive text). */
export const SEARCH_PLACEHOLDER = 'Tìm theo mã (#123), tiêu đề, nội dung — không cần gõ dấu';
