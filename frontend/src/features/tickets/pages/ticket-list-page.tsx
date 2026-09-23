import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/common/data-table';
import { PageHeader } from '@/components/common/page-header';
import { formatDateTime, slaCountdown } from '@/lib/date';
import { useUrlParams } from '@/lib/hooks/use-url-params';
import { cn } from '@/lib/utils';
import { useCan } from '@/stores/auth-store';
import type { TicketListItemDto, TicketsQuery } from '@/types';
import { CreateTicketDialog } from '../components/create-ticket-dialog';
import { PriorityBadge } from '../components/priority-badge';
import { SlaBadge } from '../components/sla-badge';
import { StatusBadge } from '../components/status-badge';
import { TicketFilters } from '../components/ticket-filters';
import { useTickets } from '../hooks/use-tickets';
import { DEFAULT_PAGE_SIZE, parseTicketQuery, sortingToSort, sortToSorting } from '../ticket-query';

interface Props {
  /** "queue" = My Queue: tickets assigned to the current user. */
  mode?: 'all' | 'queue';
}

const muted = (v: string | null | undefined) => v ?? <span className="text-muted-foreground">—</span>;

function buildColumns(showCreatedBy: boolean): ColumnDef<TicketListItemDto>[] {
  const columns: ColumnDef<TicketListItemDto>[] = [
    {
      id: 'id',
      header: 'ID',
      enableSorting: false,
      cell: ({ row }) => <span className="font-medium">#{row.original.id}</span>,
      meta: { headerClassName: 'w-20' },
    },
    {
      id: 'title',
      header: 'Title',
      cell: ({ row }) => (
        <span className="line-clamp-1 max-w-[22rem] break-all" title={row.original.title}>
          {row.original.title}
        </span>
      ),
    },
    { id: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { id: 'priority', header: 'Priority', cell: ({ row }) => <PriorityBadge priority={row.original.priority} /> },
    {
      id: 'category',
      header: 'Category',
      enableSorting: false,
      cell: ({ row }) => row.original.categoryName,
    },
    {
      id: 'assignee',
      header: 'Assignee',
      enableSorting: false,
      cell: ({ row }) => muted(row.original.assigneeName),
    },
    {
      id: 'sla',
      header: 'SLA',
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
      header: 'Created',
      cell: ({ row }) => <span className="whitespace-nowrap">{formatDateTime(row.original.createdAt)}</span>,
    },
  ];
  if (showCreatedBy) {
    columns.splice(5, 0, {
      id: 'createdBy',
      header: 'Created by',
      enableSorting: false,
      cell: ({ row }) => row.original.createdByName,
    });
  }
  return columns;
}

export function TicketListPage({ mode = 'all' }: Props) {
  const navigate = useNavigate();
  /** TICKET:R = can see all tickets (assignee filter, created-by column) */
  const canReadAll = useCan('TICKET', 'R');
  const canCreate = useCan('TICKET', 'C');
  const [searchParams, updateParams] = useUrlParams();
  const [createOpen, setCreateOpen] = useState(false);

  const urlQuery = useMemo(() => parseTicketQuery(searchParams), [searchParams]);
  const query: TicketsQuery = mode === 'queue' ? { ...urlQuery, assigneeId: 'me' } : urlQuery;

  const tickets = useTickets(query);
  const columns = useMemo(() => buildColumns(canReadAll), [canReadAll]);
  const sorting = useMemo(() => sortToSorting(query.sort), [query.sort]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={mode === 'queue' ? 'My Queue' : 'Tickets'}
        description={mode === 'queue' ? 'Các ticket đang được gán cho bạn' : undefined}
        actions={
          <>
            <Button variant="outline" size="icon" aria-label="Tải lại" onClick={() => void tickets.refetch()}>
              <RefreshCw className={cn(tickets.isFetching && 'animate-spin')} />
            </Button>
            {canCreate && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus /> New Ticket
              </Button>
            )}
          </>
        }
      />
      <Card>
        <CardContent className="space-y-4">
          <TicketFilters query={query} onChange={updateParams} showAssignee={canReadAll && mode !== 'queue'} />
          <DataTable
            aria-label="Danh sách ticket"
            columns={columns}
            data={tickets.data?.items ?? []}
            getRowId={(t) => String(t.id)}
            loading={tickets.isFetching}
            sorting={sorting}
            onSortingChange={(s) => updateParams({ sort: sortingToSort(s) })}
            onRowClick={(t) => navigate(`/tickets/${t.id}`)}
            emptyText="Không có ticket nào"
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
