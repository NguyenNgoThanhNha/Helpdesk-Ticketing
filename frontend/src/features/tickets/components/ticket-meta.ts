import type { SlaState, TicketPriority, TicketStatus } from '@/types';

export const STATUS_META: Record<TicketStatus, { label: string; className: string; dot: string }> = {
  New: {
    label: 'New',
    className: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300',
    dot: 'bg-blue-500',
  },
  Open: {
    label: 'Open',
    className: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950 dark:text-cyan-300',
    dot: 'bg-cyan-500',
  },
  InProgress: {
    label: 'In Progress',
    className:
      'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300',
    dot: 'bg-indigo-500',
  },
  Pending: {
    label: 'Pending',
    className:
      'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950 dark:text-purple-300',
    dot: 'bg-purple-500',
  },
  Resolved: {
    label: 'Resolved',
    className:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  Closed: {
    label: 'Closed',
    className: 'border-border bg-muted text-muted-foreground',
    dot: 'bg-zinc-400',
  },
};

export const PRIORITY_META: Record<TicketPriority, { label: string; className: string }> = {
  Urgent: {
    label: 'Urgent',
    className: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300',
  },
  High: {
    label: 'High',
    className:
      'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300',
  },
  Medium: {
    label: 'Medium',
    className:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
  },
  Low: { label: 'Low', className: 'border-border bg-muted text-muted-foreground' },
};

export const SLA_META: Record<SlaState, { label: string; className: string }> = {
  OnTrack: { label: 'Còn hạn (On track)', className: 'text-emerald-600 dark:text-emerald-400' },
  AtRisk: { label: 'Sắp hết hạn (At risk)', className: 'text-orange-500 dark:text-orange-400' },
  Breached: { label: 'Quá hạn (Breached)', className: 'text-red-600 dark:text-red-400' },
  Met: { label: 'Đạt SLA (Met)', className: 'text-muted-foreground' },
};
