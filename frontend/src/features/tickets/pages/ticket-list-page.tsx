import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { FilterX, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/common/data-table';
import { PageHeader } from '@/components/common/page-header';
import { formatDateTime, formatDateTimeShort, slaCountdown } from '@/lib/date';
import { useUrlParams } from '@/lib/hooks/use-url-params';
import { cn } from '@/lib/utils';
import { useCan } from '@/stores/auth-store';
import type { TicketListItemDto, TicketsQuery } from '@/types';
import { CreateTicketDialog } from '../components/create-ticket-dialog';
import { PriorityBadge } from '../components/priority-badge';
import { SlaBadge } from '../components/sla-badge';
import { StatusBadge } from '../components/status-badge';
import { TicketFilters } from '../components/ticket-filters';
import { TICKET_FIELD_LABEL as F } from '../components/ticket-meta';
import { usePrefetchTicket, useTickets } from '../hooks/use-tickets';
import { clearFiltersPatch, DEFAULT_PAGE_SIZE, hasActiveFilters, parseTicketQuery, sortingToSort, sortToSorting } from '../ticket-query';

interface Props {
  /** "queue" = My Queue: tickets assigned to the current user. */
  mode?: 'all' | 'queue';
}

/** Single-line cell that truncates long names (full text in the tooltip) so the table fits at ~1280px. */
const clip = (v: string | null | undefined, className = 'max-w-40') =>
  v ? (
    <span className={cn('block truncate', className)} title={v}>
      {v}
    </span>
  ) : (
    <span className="text-muted-foreground">—</span>
  );

/**
 * @param from the list URL (with filters / page), handed to the detail page so its back button returns here
 */
function buildColumns(showCreatedBy: boolean, from: string): ColumnDef<TicketListItemDto>[] {
  const columns: ColumnDef<TicketListItemDto>[] = [
    {
      id: 'id',
      header: F.id,
      enableSorting: false,
      cell: ({ row }) => <span className="font-medium">#{row.original.id}</span>,
      meta: { headerClassName: 'w-20' },
    },
    {
      id: 'title',
      header: F.title,
      // a real link: middle-click / Ctrl+click / "open in new tab" work, and it is the row's keyboard tab stop
      cell: ({ row }) => (
        <Link
          to={`/tickets/${row.original.id}`}
          state={{ from }}
          title={row.original.title}
          className="block max-w-56 truncate rounded-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 2xl:max-w-[26rem]"
        >
          {row.original.title}
        </Link>
      ),
    },
    { id: 'status', header: F.status, cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { id: 'priority', header: F.priority, cell: ({ row }) => <PriorityBadge priority={row.original.priority} /> },
    {
      id: 'category',
      header: F.category,
      enableSorting: false,
      cell: ({ row }) => clip(row.original.categoryName, 'max-w-32'),
    },
    {
      id: 'assignee',
      header: F.assignee,
      enableSorting: false,
      cell: ({ row }) => clip(row.original.assigneeName, 'max-w-32'),
    },
    {
      id: 'sla',
      header: F.sla,
      cell: ({ row }) => (
        <SlaBadge
          state={row.original.slaState}
          hint={row.original.resolveDueAt ? slaCountdown(row.original.resolveDueAt) : null}
        />
      ),
      meta: { headerClassName: 'w-20' },
    },
    {
      id: 'createdAt',
      header: F.createdAt,
      cell: ({ row }) => (
        <span className="whitespace-nowrap tabular-nums" title={formatDateTime(row.original.createdAt)}>
          {formatDateTimeShort(row.original.createdAt)}
        </span>
      ),
    },
  ];
  if (showCreatedBy) {
    columns.splice(5, 0, {
      id: 'createdBy',
      header: F.createdBy,
      enableSorting: false,
      cell: ({ row }) => clip(row.original.createdByName, 'max-w-32'),
      // secondary column (not in the spec wireframe): only on wide screens so the table fits at 1280px
      meta: { headerClassName: 'hidden 2xl:table-cell', cellClassName: 'hidden 2xl:table-cell' },
    });
  }
  return columns;
}

export function TicketListPage({ mode = 'all' }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const prefetchTicket = usePrefetchTicket();
  /** TICKET:R = can see all tickets (assignee filter, created-by column) */
  const canReadAll = useCan('TICKET', 'R');
  const canCreate = useCan('TICKET', 'C');
  const [searchParams, updateParams] = useUrlParams();
  const [createOpen, setCreateOpen] = useState(false);
  /** bumped when filters are cleared: remounts the filter bar, which drops a pending (debounced) search */
  const [filtersKey, setFiltersKey] = useState(0);

  const urlQuery = useMemo(() => parseTicketQuery(searchParams), [searchParams]);
  const query: TicketsQuery = mode === 'queue' ? { ...urlQuery, assigneeId: 'me' } : urlQuery;
  const showAssignee = canReadAll && mode !== 'queue';
  const filtered = hasActiveFilters(query, showAssignee);
  const clearFilters = () => {
    updateParams(clearFiltersPatch(showAssignee));
    setFiltersKey((k) => k + 1);
  };

  const from = location.pathname + location.search;
  const tickets = useTickets(query);
  const columns = useMemo(() => buildColumns(canReadAll, from), [canReadAll, from]);
  const sorting = useMemo(() => sortToSorting(query.sort), [query.sort]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={mode === 'queue' ? 'Việc của tôi' : 'Danh sách ticket'}
        description={mode === 'queue' ? 'Các ticket đang được gán cho bạn' : undefined}
        actions={
          <>
            <Button variant="outline" size="icon" aria-label="Tải lại" onClick={() => void tickets.refetch()}>
              <RefreshCw className={cn(tickets.isFetching && 'animate-spin')} />
            </Button>
            {canCreate && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus /> Tạo ticket
              </Button>
            )}
          </>
        }
      />
      <Card>
        <CardContent className="space-y-4">
          <TicketFilters
            key={filtersKey}
            query={query}
            onChange={updateParams}
            onClear={clearFilters}
            showAssignee={showAssignee}
          />
          <DataTable
            aria-label="Danh sách ticket"
            columns={columns}
            data={tickets.data?.items ?? []}
            getRowId={(t) => String(t.id)}
            loading={tickets.isFetching}
            sorting={sorting}
            onSortingChange={(s) => updateParams({ sort: sortingToSort(s) })}
            // clicks elsewhere on the row open the ticket too; the title link is the keyboard / new-tab target
            onRowClick={(t) => navigate(`/tickets/${t.id}`, { state: { from } })}
            focusableRows={false}
            onRowHover={(t) => prefetchTicket(t.id)}
            emptyText={
              filtered ? (
                <div className="flex flex-col items-center gap-2">
                  <span>Không có ticket nào khớp bộ lọc</span>
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    <FilterX /> Xóa bộ lọc
                  </Button>
                </div>
              ) : (
                'Không có ticket nào'
              )
            }
            error={tickets.isError ? 'Không tải được danh sách ticket' : undefined}
            onRetry={() => void tickets.refetch()}
            pagination={{
              page: query.page ?? 1,
              pageSize: query.pageSize ?? DEFAULT_PAGE_SIZE,
              totalCount: tickets.data?.totalCount ?? 0,
              onPageChange: (page) => updateParams({ page: page > 1 ? page : undefined }, false),
              onPageSizeChange: (size) => updateParams({ pageSize: size !== DEFAULT_PAGE_SIZE ? size : undefined }),
            }}
          />
        </CardContent>
      </Card>

      {canCreate && (
        <CreateTicketDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={(t) => navigate(`/tickets/${t.id}`)}
        />
      )}
    </div>
  );
}
