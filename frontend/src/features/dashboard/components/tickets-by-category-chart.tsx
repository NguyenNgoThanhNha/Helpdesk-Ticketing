import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/empty-state';
import type { KeyCount } from '@/types';

const config = { count: { label: 'Tickets', color: 'var(--chart-2)' } } satisfies ChartConfig;

export function TicketsByCategoryChart({ data, loading }: { data: KeyCount[] | undefined; loading: boolean }) {
  const rows = data ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Theo danh mục</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-56 w-full" />
        ) : rows.length ? (
          <ChartContainer config={config} className="aspect-auto w-full" style={{ height: Math.max(200, rows.length * 40) }}>
            <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="key" width={100} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent hideLabel={false} />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={4} />
            </BarChart>
          </ChartContainer>
        ) : (
          <EmptyState title="Không có dữ liệu" />
        )}
      </CardContent>
    </Card>
  );
}
