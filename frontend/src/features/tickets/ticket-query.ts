import type { SortingState } from '@tanstack/react-table';
import { oneOf, toPositiveInt } from '@/lib/hooks/use-url-params';
import {
  SLA_STATES,
  TICKET_PRIORITIES,
  TICKET_SORTS,
  TICKET_STATUSES,
  type SlaState,
  type TicketPriority,
  type TicketSort,
  type TicketStatus,
  type TicketsQuery,
} from '@/types';

export const DEFAULT_PAGE_SIZE = 20;
export const DEFAULT_SORT: TicketSort = 'createdAt_desc';

/** Reads the ticket list query from URL search params. */
export function parseTicketQuery(params: URLSearchParams): TicketsQuery {
  return {
    status: oneOf<TicketStatus>(TICKET_STATUSES, params.get('status')),
    priority: oneOf<TicketPriority>(TICKET_PRIORITIES, params.get('priority')),
    slaState: oneOf<SlaState>(SLA_STATES, params.get('slaState')),
    categoryId: toPositiveInt(params.get('categoryId')),
    assigneeId: params.get('assigneeId') || undefined,
    search: params.get('search') || undefined,
    page: toPositiveInt(params.get('page')) ?? 1,
    pageSize: Math.min(toPositiveInt(params.get('pageSize')) ?? DEFAULT_PAGE_SIZE, 100),
    sort: oneOf<TicketSort>(TICKET_SORTS, params.get('sort')) ?? DEFAULT_SORT,
  };
}

/** table column id → API sort field */
export const SORT_FIELDS: Record<string, string> = {
  title: 'title',
  status: 'status',
  priority: 'priority',
  createdAt: 'createdAt',
  sla: 'resolveDueAt',
};

/** "createdAt_desc" → [{ id: 'createdAt', desc: true }] */
export function sortToSorting(sort: TicketSort | undefined): SortingState {
  const [field, dir] = (sort ?? DEFAULT_SORT).split('_');
  const id = Object.keys(SORT_FIELDS).find((k) => SORT_FIELDS[k] === field);
  return id ? [{ id, desc: dir === 'desc' }] : [];
}

/** SortingState → API sort param (undefined when it equals the default, so the URL stays clean). */
export function sortingToSort(sorting: SortingState): string | undefined {
  const s = sorting[0];
  const field = s ? SORT_FIELDS[s.id] : undefined;
  const sort = s && field ? `${field}_${s.desc ? 'desc' : 'asc'}` : undefined;
  return sort === DEFAULT_SORT ? undefined : sort;
}
