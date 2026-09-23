import { useEffect, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { CircleAlert, Info, Loader2, Save } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/common/data-table';
import { PriorityBadge } from '@/features/tickets';
import { TICKET_PRIORITIES, type SlaPolicyDto, type TicketPriority } from '@/types';
import { useSlaPolicies, useUpdateSlaPolicy } from '../hooks/use-sla-policies';

type DraftRow = { responseHours: string; resolveHours: string };
type Draft = Partial<Record<TicketPriority, DraftRow>>;

/** Returns an error message, or null when the row is valid. */
export function validateSlaRow(d: DraftRow | undefined): string | null {
  if (!d || d.responseHours.trim() === '' || d.resolveHours.trim() === '') return 'Nhập đủ số giờ';
  const response = Number(d.responseHours);
  const resolve = Number(d.resolveHours);
  if (!Number.isFinite(response) || !Number.isFinite(resolve)) return 'Số giờ không hợp lệ';
  if (response <= 0 || resolve <= 0) return 'Số giờ phải > 0';
  if (response > resolve) return 'Phản hồi phải ≤ giải quyết';
  return null;
}

export function SlaPoliciesTab() {
  const { data, isLoading } = useSlaPolicies();
  const save = useUpdateSlaPolicy();
  const [draft, setDraft] = useState<Draft>({});

  useEffect(() => {
    if (data) {
      setDraft(
        Object.fromEntries(
          data.map((p) => [p.priority, { responseHours: String(p.responseHours), resolveHours: String(p.resolveHours) }]),
        ) as Draft,
      );
    }
  }, [data]);

  const rows = [...(data ?? [])].sort(
    (a, b) => TICKET_PRIORITIES.indexOf(b.priority) - TICKET_PRIORITIES.indexOf(a.priority),
  );

  const setField = (priority: TicketPriority, field: keyof DraftRow, value: string) =>
    setDraft((prev) => ({
      ...prev,
      [priority]: { responseHours: '', resolveHours: '', ...prev[priority], [field]: value },
    }));

  const hoursInput = (p: SlaPolicyDto, field: keyof DraftRow, label: string) => (
    <Input
      type="number"
      min={0.5}
      step={0.5}
      aria-label={`${label} ${p.priority}`}
      className="w-28"
      value={draft[p.priority]?.[field] ?? ''}
      onChange={(e) => setField(p.priority, field, e.target.value)}
    />
  );

  const columns: ColumnDef<SlaPolicyDto>[] = [
    { id: 'priority', header: 'Priority', cell: ({ row }) => <PriorityBadge priority={row.original.priority} /> },
    { id: 'response', header: 'Phản hồi (giờ)', cell: ({ row }) => hoursInput(row.original, 'responseHours', 'Response hours') },
    { id: 'resolve', header: 'Giải quyết (giờ)', cell: ({ row }) => hoursInput(row.original, 'resolveHours', 'Resolve hours') },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const p = row.original;
        const d = draft[p.priority];
        const dirty =
          !!d && (Number(d.responseHours) !== p.responseHours || Number(d.resolveHours) !== p.resolveHours);
        const error = dirty ? validateSlaRow(d) : null;
        if (error) {
          return (
            <span className="inline-flex items-center gap-1.5 text-sm text-destructive">
              <CircleAlert className="size-4" /> {error}
            </span>
          );
        }
        const saving = save.isPending && save.variables?.priority === p.priority;
        return (
          <Button
            size="sm"
            disabled={!dirty || saving}
            onClick={() =>
              d &&
              save.mutate({ priority: p.priority, responseHours: Number(d.responseHours), resolveHours: Number(d.resolveHours) })
            }
          >
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            Lưu
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <Alert>
        <Info />
        <AlertDescription>Thời hạn SLA áp dụng cho ticket mới theo mức ưu tiên.</AlertDescription>
      </Alert>
      <DataTable aria-label="SLA policies" columns={columns} data={rows} getRowId={(p) => p.priority} loading={isLoading} />
    </div>
  );
}
