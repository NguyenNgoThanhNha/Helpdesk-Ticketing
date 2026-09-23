import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleCheck, Clock, FolderOpen, Inbox, Siren } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { ReportSummaryDto } from '@/types';
import { fmtHours, fmtPct } from '../format';

function Kpi({
  title,
  value,
  icon,
  loading,
  valueClassName,
  to,
}: {
  title: string;
  value: ReactNode;
  icon: ReactNode;
  loading: boolean;
  valueClassName?: string;
  to?: string;
}) {
  const navigate = useNavigate();
  const clickable = !!to;
  return (
    <Card
      className={cn(clickable && 'cursor-pointer transition-shadow hover:shadow-md')}
      onClick={to ? () => navigate(to) : undefined}
      role={clickable ? 'link' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={to ? (e) => e.key === 'Enter' && navigate(to) : undefined}
    >
      <CardContent className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">{title}</div>
          {loading ? (
            <Skeleton className="h-7 w-16" />
          ) : (
            <div className={cn('text-2xl font-semibold tabular-nums', valueClassName)}>{value}</div>
          )}
        </div>
        <div className="rounded-lg bg-muted p-2 text-muted-foreground [&_svg]:size-5">{icon}</div>
      </CardContent>
    </Card>
  );
}

export function KpiCards({ data, loading }: { data: ReportSummaryDto | undefined; loading: boolean }) {
  const compliance = data?.slaComplianceRate;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <Kpi title="Tổng" value={data?.totalTickets ?? 0} icon={<Inbox />} loading={loading} to="/tickets" />
      <Kpi title="Open" value={data?.openTickets ?? 0} icon={<FolderOpen />} loading={loading} to="/tickets?status=Open" />
      <Kpi
        title="Quá SLA"
        value={data?.breachedTickets ?? 0}
        icon={<Siren />}
        loading={loading}
        valueClassName="text-red-600 dark:text-red-400"
        to="/tickets?slaState=Breached"
      />
      <Kpi title="Avg resolution" value={fmtHours(data?.avgResolutionHours)} icon={<Clock />} loading={loading} />
      <Kpi
        title="SLA compliance"
        value={fmtPct(compliance)}
        icon={<CircleCheck />}
        loading={loading}
        valueClassName={
          compliance == null ? undefined : compliance >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
        }
      />
    </div>
  );
}
