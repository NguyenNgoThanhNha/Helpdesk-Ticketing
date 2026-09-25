import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { dayjs } from '@/lib/date';
import { fmtInt, TICKET_COUNT_LABEL } from '../format';
import { ChartDataTable } from './chart-data-table';

const TITLE = 'Ticket theo ngày';
const config = { count: { label: TICKET_COUNT_LABEL, color: 'var(--primary)' } } satisfies ChartConfig;

const fmtDay = (d: string) => dayjs(d).format('DD/MM/YYYY');

/** "Tổng 120 ticket trong 30 ngày (01/09/2026 – 30/09/2026), nhiều nhất 12 vào 20/09/2026." */
function summarize(days: { date: string; count: number }[]): string {
  if (!days.length) return `Biểu đồ ${TITLE.toLowerCase()}: không có dữ liệu.`;
  const total = days.reduce((sum, d) => sum + d.count, 0);
  const peak = days.reduce((max, d) => (d.count > max.count ? d : max), days[0]);
  const range = `${fmtDay(days[0].date)} – ${fmtDay(days[days.length - 1].date)}`;
  return (
    `Biểu đồ ${TITLE.toLowerCase()}: tổng ${fmtInt(total)} ticket trong ${days.length} ngày (${range})` +
    (peak.count > 0 ? `, nhiều nhất ${fmtInt(peak.count)} vào ${fmtDay(peak.date)}.` : '.')
  );
}

export function TicketsByDayChart({
  data,
  loading,
}: {
  data: { date: string; count: number }[] | undefined;
  loading: boolean;
}) {
  const days = data ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle>{TITLE}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-72 w-full" />
        ) : (
          <>
            <ChartContainer config={config} className="aspect-auto h-72 w-full" role="img" aria-label={summarize(days)}>
              <LineChart data={days} margin={{ top: 8, right: 12, left: -16, bottom: 0 }} accessibilityLayer={false}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                  tickFormatter={(d: string) => dayjs(d).format('DD/MM')}
                />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent labelFormatter={(d) => fmtDay(String(d))} />} />
                <Line type="monotone" dataKey="count" stroke="var(--color-count)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
            {days.length > 0 && (
              <ChartDataTable
                caption={TITLE}
                headers={['Ngày', TICKET_COUNT_LABEL]}
                rows={days.map((d) => [fmtDay(d.date), fmtInt(d.count)] as const)}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
