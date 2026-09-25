import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/empty-state';
import type { KeyCount } from '@/types';
import { fmtInt, TICKET_COUNT_LABEL } from '../format';
import { ChartDataTable } from './chart-data-table';

const TITLE = 'Ticket theo danh mục';
const config = { count: { label: TICKET_COUNT_LABEL, color: 'var(--chart-2)' } } satisfies ChartConfig;

export function TicketsByCategoryChart({ data, loading }: { data: KeyCount[] | undefined; loading: boolean }) {
  const rows = data ?? [];
  const summary = `Biểu đồ ${TITLE.toLowerCase()}: ${rows.map((r) => `${r.key} ${fmtInt(r.count)}`).join(', ')}.`;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{TITLE}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-56 w-full" />
        ) : rows.length ? (
          <>
            <ChartContainer
              config={config}
              className="aspect-auto w-full"
              style={{ height: Math.max(200, rows.length * 40) }}
              role="img"
              aria-label={summary}
            >
              <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16 }} accessibilityLayer={false}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="key" width={100} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent hideLabel={false} />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={4} />
              </BarChart>
            </ChartContainer>
            <ChartDataTable
              caption={TITLE}
              headers={['Danh mục', TICKET_COUNT_LABEL]}
              rows={rows.map((r) => [r.key, fmtInt(r.count)] as const)}
            />
          </>
        ) : (
          <EmptyState title="Không có dữ liệu" />
        )}
      </CardContent>
    </Card>
  );
}
