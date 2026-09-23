import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card, Input, Select, Space, Table, Typography, type TableProps } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import type { SorterResult } from 'antd/es/table/interface';
import { useCan } from '@/stores/authStore';
import {
  SLA_STATES,
  TICKET_PRIORITIES,
  TICKET_SORTS,
  TICKET_STATUSES,
  type SlaState,
  type TicketListItemDto,
  type TicketPriority,
  type TicketSort,
  type TicketStatus,
  type TicketsQuery,
} from '@/types';
import { formatDateTime, slaCountdown } from '@/utils/format';
import { CreateTicketModal } from './CreateTicketModal';
import { PriorityTag, SLA_META, SlaBadge, StatusTag, STATUS_META } from './components';
import { useAssignees, useCategories, useTickets } from './hooks';

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_SORT: TicketSort = 'createdAt_desc';

/** column key -> sort field name used by the API */
const SORT_FIELDS: Record<string, string> = {
  title: 'title',
  status: 'status',
  priority: 'priority',
  createdAt: 'createdAt',
  sla: 'resolveDueAt',
};

function oneOf<T extends string>(values: readonly T[], v: string | null): T | undefined {
  return v && (values as readonly string[]).includes(v) ? (v as T) : undefined;
}

function toPositiveInt(v: string | null): number | undefined {
  const n = v ? Number(v) : NaN;
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

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

interface Props {
  /** "queue" = My Queue: tickets assigned to the current user. */
  mode?: 'all' | 'queue';
}

export function TicketListPage({ mode = 'all' }: Props) {
  const navigate = useNavigate();
  /** TICKET:R = can see all tickets (assignee filter, created-by column) */
  const canReadAll = useCan('TICKET', 'R');
  const canCreate = useCan('TICKET', 'C');
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);

  const urlQuery = useMemo(() => parseTicketQuery(searchParams), [searchParams]);
  const query: TicketsQuery = mode === 'queue' ? { ...urlQuery, assigneeId: 'me' } : urlQuery;

  const [searchText, setSearchText] = useState(urlQuery.search ?? '');
  useEffect(() => setSearchText(urlQuery.search ?? ''), [urlQuery.search]);

  const tickets = useTickets(query);
  const categories = useCategories();
  const assignees = useAssignees();

  /** Updates URL params; filter changes reset the page to 1. */
  const updateParams = (patch: Record<string, string | number | undefined | null>, resetPage = true) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(patch)) {
          if (value === undefined || value === null || value === '') next.delete(key);
          else next.set(key, String(value));
        }
        if (resetPage) next.delete('page');
        return next;
      },
      { replace: true },
    );
  };

  const [sortField, sortDir] = (query.sort ?? DEFAULT_SORT).split('_') as [string, 'asc' | 'desc'];
  const sortOrderFor = (columnKey: string) =>
    SORT_FIELDS[columnKey] === sortField ? (sortDir === 'asc' ? 'ascend' : 'descend') : null;

  const columns: TableProps<TicketListItemDto>['columns'] = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 90,
      render: (id: number) => <Typography.Text strong>#{id}</Typography.Text>,
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      sorter: true,
      sortOrder: sortOrderFor('title'),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      sorter: true,
      sortOrder: sortOrderFor('status'),
      render: (s: TicketStatus) => <StatusTag status={s} />,
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 110,
      sorter: true,
      sortOrder: sortOrderFor('priority'),
      render: (p: TicketPriority) => <PriorityTag priority={p} />,
    },
    { title: 'Category', dataIndex: 'categoryName', key: 'category', width: 140, ellipsis: true },
    {
      title: 'Assignee',
      dataIndex: 'assigneeName',
      key: 'assignee',
      width: 150,
      ellipsis: true,
      render: (name: string | null) => name ?? <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: 'SLA',
      dataIndex: 'slaState',
      key: 'sla',
      width: 80,
      align: 'center',
      sorter: true,
      sortOrder: sortOrderFor('sla'),
      render: (state: SlaState, row) => (
        <span title={row.resolveDueAt ? (slaCountdown(row.resolveDueAt) ?? undefined) : undefined}>
          <SlaBadge state={state} />
        </span>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      sorter: true,
      sortOrder: sortOrderFor('createdAt'),
      render: (v: string) => formatDateTime(v),
    },
  ];

  if (canReadAll) {
    columns.splice(5, 0, {
      title: 'Created by',
      dataIndex: 'createdByName',
      key: 'createdBy',
      width: 140,
      ellipsis: true,
    });
  }

  const handleTableChange: TableProps<TicketListItemDto>['onChange'] = (pagination, _filters, sorter, extra) => {
    if (extra.action === 'sort') {
      const s = (Array.isArray(sorter) ? sorter[0] : sorter) as SorterResult<TicketListItemDto>;
      const field = s?.order ? SORT_FIELDS[String(s.columnKey)] : undefined;
      const sort = field ? `${field}_${s.order === 'ascend' ? 'asc' : 'desc'}` : undefined;
      updateParams({ sort: sort === DEFAULT_SORT ? undefined : sort });
      return;
    }
    updateParams(
      {
        page: pagination.current && pagination.current > 1 ? pagination.current : undefined,
        pageSize: pagination.pageSize && pagination.pageSize !== DEFAULT_PAGE_SIZE ? pagination.pageSize : undefined,
      },
      false,
    );
  };

  const assigneeOptions = [
    { value: 'me', label: 'Của tôi' },
    { value: 'unassigned', label: 'Chưa gán' },
    ...(assignees.data ?? []).map((a) => ({ value: a.id, label: a.fullName })),
  ];

  return (
    <Card
      title={mode === 'queue' ? 'My Queue' : 'Tickets'}
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void tickets.refetch()} aria-label="Tải lại" />
          {canCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              New Ticket
            </Button>
          )}
        </Space>
      }
    >
      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          aria-label="Status filter"
          data-testid="filter-status"
          allowClear
          placeholder="Status"
          style={{ width: 150 }}
          value={query.status}
          onChange={(v?: string) => updateParams({ status: v })}
          options={TICKET_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label }))}
        />
        <Select
          aria-label="Priority filter"
          data-testid="filter-priority"
          allowClear
          placeholder="Priority"
          style={{ width: 130 }}
          value={query.priority}
          onChange={(v?: string) => updateParams({ priority: v })}
          options={TICKET_PRIORITIES.map((p) => ({ value: p, label: p }))}
        />
        <Select
          aria-label="Category filter"
          allowClear
          placeholder="Category"
          style={{ width: 170 }}
          value={query.categoryId}
          loading={categories.isLoading}
          onChange={(v?: number) => updateParams({ categoryId: v })}
          options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
        />
        {canReadAll && mode !== 'queue' && (
          <Select
            aria-label="Assignee filter"
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Assignee"
            style={{ width: 200 }}
            value={query.assigneeId}
            loading={assignees.isLoading}
            onChange={(v?: string) => updateParams({ assigneeId: v })}
            options={assigneeOptions}
          />
        )}
        <Select
          aria-label="SLA filter"
          allowClear
          placeholder="SLA"
          style={{ width: 170 }}
          value={query.slaState}
          onChange={(v?: string) => updateParams({ slaState: v })}
          options={SLA_STATES.map((s) => ({ value: s, label: SLA_META[s].label }))}
        />
        <Input.Search
          aria-label="Tìm kiếm"
          placeholder="Tìm theo tiêu đề / mô tả"
          allowClear
          style={{ width: 260 }}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onSearch={(v) => updateParams({ search: v.trim() || undefined })}
        />
      </Space>

      <Table<TicketListItemDto>
        rowKey="id"
        size="middle"
        columns={columns}
        dataSource={tickets.data?.items ?? []}
        loading={tickets.isFetching}
        onChange={handleTableChange}
        rowClassName={() => 'clickable-row'}
        onRow={(record) => ({ onClick: () => navigate(`/tickets/${record.id}`) })}
        scroll={{ x: 1000 }}
        pagination={{
          current: query.page,
          pageSize: query.pageSize,
          total: tickets.data?.totalCount ?? 0,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50, 100],
          showTotal: (total) => `Tổng: ${total}`,
        }}
      />

      {canCreate && (
        <CreateTicketModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={(t) => navigate(`/tickets/${t.id}`)}
        />
      )}
    </Card>
  );
}
