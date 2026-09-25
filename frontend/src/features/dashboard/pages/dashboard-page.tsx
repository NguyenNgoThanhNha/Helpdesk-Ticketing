import { useState } from 'react';
import { DateRangePicker } from '@/components/common/date-range-picker';
import { PageHeader } from '@/components/common/page-header';
import { lastDays, toApiDate, type DateRangeValue } from '@/lib/date';
import { AgentPerformanceTable } from '../components/agent-performance-table';
import { KpiCards } from '../components/kpi-cards';
import { StatusDonut } from '../components/status-donut';
import { TicketsByCategoryChart } from '../components/tickets-by-category-chart';
import { TicketsByDayChart } from '../components/tickets-by-day-chart';
import { useReportSummary } from '../hooks/use-report-summary';

/** Dashboard = KPIs + reports (the former /reports page redirects here). */
export function DashboardPage() {
  const [range, setRange] = useState<DateRangeValue>(() => lastDays(30));
  const params = { from: toApiDate(range.from), to: toApiDate(range.to) };
  const { data, isLoading } = useReportSummary(params);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tổng quan"
        description="Báo cáo ticket, SLA và hiệu suất xử lý"
        actions={<DateRangePicker value={range} onChange={(r) => r && setRange(r)} />}
      />
      <KpiCards data={data} loading={isLoading} />
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <StatusDonut data={data?.byStatus} loading={isLoading} />
        </div>
        <div className="lg:col-span-3">
          <TicketsByDayChart data={data?.byDay} loading={isLoading} />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <AgentPerformanceTable data={data?.agentPerformance} loading={isLoading} />
        </div>
        <TicketsByCategoryChart data={data?.byCategory} loading={isLoading} />
      </div>
    </div>
  );
}
