import type { ColumnDef } from '@tanstack/react-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/common/data-table';
import { cn } from '@/lib/utils';
import type { AgentPerformanceDto } from '@/types';
import { fmtHours, fmtPct } from '../format';

function Meter({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-2 w-24 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={cn('h-full rounded-full bg-primary', className)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 text-right text-xs tabular-nums">{fmtPct(value)}</span>
    </div>
  );
}

const right = { headerClassName: 'text-right', cellClassName: 'text-right tabular-nums' };

const columns: ColumnDef<AgentPerformanceDto>[] = [
  { id: 'agentName', header: 'Agent', cell: ({ row }) => <span className="font-medium">{row.original.agentName}</span> },
  { id: 'assigned', header: 'Được gán', cell: ({ row }) => row.original.assigned, meta: right },
  { id: 'resolved', header: 'Đã giải quyết', cell: ({ row }) => row.original.resolved, meta: right },
  {
    id: 'resolvedRate',
    header: 'Tỉ lệ giải quyết',
    cell: ({ row }) => (
      <Meter value={row.original.assigned ? (row.original.resolved / row.original.assigned) * 100 : 0} />
    ),
  },
  { id: 'avg', header: 'Avg resolution', cell: ({ row }) => fmtHours(row.original.avgResolutionHours), meta: right },
  {
    id: 'sla',
    header: 'SLA compliance',
    cell: ({ row }) => {
      const v = row.original.slaComplianceRate;
      if (v === null) return <span className="text-muted-foreground">—</span>;
      return <Meter value={v} className={v >= 80 ? 'bg-emerald-500' : v >= 60 ? 'bg-amber-500' : 'bg-red-500'} />;
    },
  },
];

export function AgentPerformanceTable({ data, loading }: { data: AgentPerformanceDto[] | undefined; loading: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hiệu suất Agent</CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          aria-label="Hiệu suất Agent"
          columns={columns}
          data={data ?? []}
          getRowId={(r) => r.agentId}
          loading={loading}
          emptyText="Chưa có dữ liệu agent"
        />
      </CardContent>
    </Card>
  );
}
