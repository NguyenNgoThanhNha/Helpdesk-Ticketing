import { Cell, Label, Pie, PieChart } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/empty-state';
import { statusLabel } from '@/lib/labels';
import type { KeyCount } from '@/types';
import { FALLBACK_CHART_COLORS, fmtInt, fmtPct, STATUS_CHART_COLORS, TICKET_COUNT_LABEL } from '../format';
import { ChartDataTable } from './chart-data-table';

const TITLE = 'Ticket theo trạng thái';

export function StatusDonut({ data, loading }: { data: KeyCount[] | undefined; loading: boolean }) {
  const rows = (data ?? []).filter((s) => s.count > 0);
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const config: ChartConfig = Object.fromEntries(
    rows.map((r, i) => [
      r.key,
      {
        label: statusLabel(r.key),
        color: STATUS_CHART_COLORS[r.key] ?? FALLBACK_CHART_COLORS[i % FALLBACK_CHART_COLORS.length],
      },
    ]),
  );
  const share = (count: number) => fmtPct((count / total) * 100);
  const summary = `Biểu đồ ${TITLE.toLowerCase()}, tổng ${fmtInt(total)}: ${rows
    .map((r) => `${statusLabel(r.key)} ${fmtInt(r.count)} (${share(r.count)})`)
    .join(', ')}.`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{TITLE}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="mx-auto aspect-square h-64 rounded-full" />
        ) : rows.length ? (
          <>
            <ChartContainer config={config} className="mx-auto aspect-square max-h-80" role="img" aria-label={summary}>
              <PieChart accessibilityLayer={false}>
                <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel />} />
                <Pie data={rows} dataKey="count" nameKey="key" innerRadius={60} outerRadius={95} paddingAngle={2} strokeWidth={2}>
                  {rows.map((r) => (
                    <Cell key={r.key} fill={`var(--color-${r.key})`} />
                  ))}
                  <Label
                    content={({ viewBox }) =>
                      viewBox && 'cx' in viewBox && 'cy' in viewBox ? (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-semibold">
                            {fmtInt(total)}
                          </tspan>
                          <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 20} className="fill-muted-foreground text-xs">
                            ticket
                          </tspan>
                        </text>
                      ) : null
                    }
                  />
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="key" />} className="flex-wrap gap-2" />
              </PieChart>
            </ChartContainer>
            <ChartDataTable
              caption={TITLE}
              headers={['Trạng thái', TICKET_COUNT_LABEL]}
              rows={rows.map((r) => [statusLabel(r.key), `${fmtInt(r.count)} (${share(r.count)})`] as const)}
            />
          </>
        ) : (
          <EmptyState title="Không có dữ liệu" />
        )}
      </CardContent>
    </Card>
  );
}
