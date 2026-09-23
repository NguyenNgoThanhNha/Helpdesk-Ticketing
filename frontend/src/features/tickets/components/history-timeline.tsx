import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/empty-state';
import { formatDateTime } from '@/lib/date';
import type { TicketHistoryDto } from '@/types';

export function historyText(h: TicketHistoryDto): ReactNode {
  const arrow = (
    <>
      {h.oldValue ?? '—'} → <b>{h.newValue ?? '—'}</b>
    </>
  );
  switch (h.field) {
    case 'Created':
      return 'Tạo ticket';
    case 'Status':
      return <>Đổi trạng thái: {arrow}</>;
    case 'Priority':
      return <>Đổi ưu tiên: {arrow}</>;
    case 'Assignee':
      return h.newValue ? (
        <>
          Gán cho <b>{h.newValue}</b>
          {h.oldValue ? ` (trước: ${h.oldValue})` : ''}
        </>
      ) : (
        <>Bỏ gán {h.oldValue ?? ''}</>
      );
    case 'Sla':
      return <>SLA: {arrow}</>;
    default:
      return (
        <>
          {h.field}: {arrow}
        </>
      );
  }
}

/** Audit history (newest first). `changedBy = null` → system (SLA job). */
export function HistoryTimeline({ items, loading }: { items: TicketHistoryDto[] | undefined; loading?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>History (audit)</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : items?.length ? (
          <ol className="relative space-y-4 border-l pl-4" aria-label="Lịch sử thay đổi">
            {items.map((h) => (
              <li key={h.id} className="relative text-sm">
                <span aria-hidden className="absolute top-1.5 -left-[1.3rem] size-2 rounded-full bg-primary ring-4 ring-card" />
                <div>{historyText(h)}</div>
                <div className="text-xs text-muted-foreground">
                  {h.changedBy?.fullName ?? 'Hệ thống'} · {formatDateTime(h.changedAt)}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState title="Chưa có lịch sử" className="py-4" />
        )}
      </CardContent>
    </Card>
  );
}
