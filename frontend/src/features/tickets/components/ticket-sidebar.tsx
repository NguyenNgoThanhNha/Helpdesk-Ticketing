import { useEffect, useState, type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { dayjs, formatDateTime, slaCountdown } from '@/lib/date';
import type { TicketDetailDto } from '@/types';
import { SlaBadge } from './sla-badge';
import { TICKET_FIELD_LABEL as F } from './ticket-meta';

/** Re-renders every minute so SLA countdown text stays fresh. */
function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => dayjs());
  useEffect(() => {
    const t = setInterval(() => setNow(dayjs()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] items-center gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function SlaDue({ ticket }: { ticket: TicketDetailDto }) {
  const now = useNow();
  if (!ticket.resolveDueAt) return <span className="text-muted-foreground">—</span>;
  const finished = ticket.status === 'Resolved' || ticket.status === 'Closed';
  return (
    <div className="space-y-0.5">
      <SlaBadge state={ticket.slaState} text={finished ? null : slaCountdown(ticket.resolveDueAt, now)} />
      <div className="text-xs text-muted-foreground">Hạn: {formatDateTime(ticket.resolveDueAt)}</div>
    </div>
  );
}

/** Read-only ticket info (the status / priority / assignee editors live in the page header). */
export function TicketSidebar({ ticket }: { ticket: TicketDetailDto }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Thông tin</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-3">
          <Row label={F.category}>{ticket.category.name}</Row>
          <Row label={F.requester}>{ticket.createdBy.fullName}</Row>
          <Row label={F.createdAt}>{formatDateTime(ticket.createdAt)}</Row>
          {ticket.responseDueAt && !ticket.firstRespondedAt && (
            <Row label={F.responseDueAt}>{formatDateTime(ticket.responseDueAt)}</Row>
          )}
          <Row label={F.sla}>
            <SlaDue ticket={ticket} />
          </Row>
          {ticket.resolvedAt && <Row label={F.resolvedAt}>{formatDateTime(ticket.resolvedAt)}</Row>}
          {ticket.closedAt && <Row label={F.closedAt}>{formatDateTime(ticket.closedAt)}</Row>}
        </dl>
      </CardContent>
    </Card>
  );
}
