import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/empty-state';
import { formatDateTime } from '@/lib/date';
import { priorityLabel, slaStateLabel, statusLabel } from '@/lib/labels';
import type { TicketHistoryDto } from '@/types';

/** old → new, with enum values (status / priority / SLA state) shown by their Vietnamese label. */
function Change({ h, label = (v) => v ?? '—' }: { h: TicketHistoryDto; label?: (v: string | null) => string }) {
  return (
    <>
      {label(h.oldValue)} → <b>{label(h.newValue)}</b>
    </>
  );
}

export function historyText(h: TicketHistoryDto): ReactNode {
  switch (h.field) {
    case 'Created':
      return 'Tạo ticket';
    case 'Status':
      return (
        <>
          Đổi trạng thái: <Change h={h} label={statusLabel} />
        </>
      );
    case 'Priority':
      return (
        <>
          Đổi ưu tiên: <Change h={h} label={priorityLabel} />
        </>
      );
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
      return (
        <>
          SLA: <Change h={h} label={slaStateLabel} />
        </>
      );
    default:
      return (
        <>
          {h.field}: <Change h={h} />
        </>
      );
  }
}

/** Audit history (newest first). `changedBy = null` → system (SLA job). */
export function HistoryTimeline({ items, loading }: { items: TicketHistoryDto[] | undefined; loading?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lịch sử thay đổi</CardTitle>
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
