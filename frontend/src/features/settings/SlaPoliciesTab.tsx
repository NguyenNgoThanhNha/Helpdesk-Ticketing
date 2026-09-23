import { useEffect, useState } from 'react';
import { Alert, App, Button, InputNumber, Table, type TableProps } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { slaApi } from '@/api/endpoints';
import { queryKeys } from '@/api/queryClient';
import { PriorityTag } from '@/features/tickets/components';
import { TICKET_PRIORITIES, type SlaPolicyDto, type TicketPriority } from '@/types';

type Draft = Record<TicketPriority, { responseHours: number | null; resolveHours: number | null }>;

function validate(d: Draft[TicketPriority] | undefined): string | null {
  if (!d || d.responseHours == null || d.resolveHours == null) return 'Nhập đủ số giờ';
  if (d.responseHours <= 0 || d.resolveHours <= 0) return 'Số giờ phải > 0';
  if (d.responseHours > d.resolveHours) return 'Phản hồi phải ≤ giải quyết';
  return null;
}

export function SlaPoliciesTab() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: queryKeys.slaPolicies, queryFn: slaApi.list });
  const [draft, setDraft] = useState<Partial<Draft>>({});

  useEffect(() => {
    if (data) {
      setDraft(
        Object.fromEntries(
          data.map((p) => [p.priority, { responseHours: p.responseHours, resolveHours: p.resolveHours }]),
        ) as Partial<Draft>,
      );
    }
  }, [data]);

  const save = useMutation({
    mutationFn: ({ priority, responseHours, resolveHours }: { priority: TicketPriority; responseHours: number; resolveHours: number }) =>
      slaApi.update(priority, { responseHours, resolveHours }),
    onSuccess: (p) => {
      void message.success(`Đã lưu SLA cho ${p.priority}`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.slaPolicies });
    },
  });

  const rows = [...(data ?? [])].sort(
    (a, b) => TICKET_PRIORITIES.indexOf(b.priority) - TICKET_PRIORITIES.indexOf(a.priority),
  );

  const setField = (priority: TicketPriority, field: 'responseHours' | 'resolveHours', value: number | null) =>
    setDraft((prev) => ({
      ...prev,
      [priority]: { responseHours: null, resolveHours: null, ...prev[priority], [field]: value },
    }));

  const columns: TableProps<SlaPolicyDto>['columns'] = [
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 130,
      render: (p: TicketPriority) => <PriorityTag priority={p} />,
    },
    {
      title: 'Phản hồi (giờ)',
      key: 'response',
      render: (_, p) => (
        <InputNumber
          aria-label={`Response hours ${p.priority}`}
          min={0.5}
          step={0.5}
          value={draft[p.priority]?.responseHours ?? null}
          onChange={(v) => setField(p.priority, 'responseHours', v)}
        />
      ),
    },
    {
      title: 'Giải quyết (giờ)',
      key: 'resolve',
      render: (_, p) => (
        <InputNumber
          aria-label={`Resolve hours ${p.priority}`}
          min={0.5}
          step={0.5}
          value={draft[p.priority]?.resolveHours ?? null}
          onChange={(v) => setField(p.priority, 'resolveHours', v)}
        />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 260,
      render: (_, p) => {
        const d = draft[p.priority];
        const dirty = !!d && (d.responseHours !== p.responseHours || d.resolveHours !== p.resolveHours);
        const error = dirty ? validate(d) : null;
        return error ? (
          <Alert type="error" message={error} showIcon style={{ padding: '2px 8px' }} />
        ) : (
          <Button
            type="primary"
            size="small"
            icon={<SaveOutlined />}
            disabled={!dirty}
            loading={save.isPending && save.variables?.priority === p.priority}
            onClick={() =>
              d &&
              save.mutate({ priority: p.priority, responseHours: d.responseHours!, resolveHours: d.resolveHours! })
            }
          >
            Lưu
          </Button>
        );
      },
    },
  ];

  return (
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Thời hạn SLA áp dụng cho ticket mới theo mức ưu tiên."
      />
      <Table<SlaPolicyDto> rowKey="priority" loading={isLoading} columns={columns} dataSource={rows} pagination={false} />
    </>
  );
}
