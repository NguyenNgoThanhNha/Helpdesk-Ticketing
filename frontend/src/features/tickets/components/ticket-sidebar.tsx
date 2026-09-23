import { useEffect, useState, type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/common/combobox';
import { dayjs, formatDateTime, slaCountdown } from '@/lib/date';
import { TICKET_PRIORITIES, type TicketDetailDto, type UpdateTicketRequest } from '@/types';
import { useAssignees } from '../hooks/use-lookups';
import { PriorityBadge } from './priority-badge';
import { SlaBadge } from './sla-badge';
import { PRIORITY_META, STATUS_META } from './ticket-meta';

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
    <div className="grid grid-cols-[7rem_1fr] items-center gap-2 text-sm">
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

export interface TicketSidebarProps {
  ticket: TicketDetailDto;
  pending: boolean;
  onPatch: (changes: Omit<UpdateTicketRequest, 'rowVersion'>) => void;
}

/** Ticket info with inline status / priority / assignee editors (gated by the flags the API returns). */
export function TicketSidebar({ ticket, pending, onPatch }: TicketSidebarProps) {
  const assignees = useAssignees();

  const statusOptions = [ticket.status, ...ticket.allowedTransitions.filter((s) => s !== ticket.status)];

  const agentOptions = (assignees.data ?? []).map((a) => ({ value: a.id, label: a.fullName }));
  if (ticket.assignee && !agentOptions.some((o) => o.value === ticket.assignee?.id)) {
    agentOptions.unshift({ value: ticket.assignee.id, label: ticket.assignee.fullName });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Thông tin</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-3">
          <Row label="Status">
            <Select
              value={ticket.status}
              disabled={ticket.allowedTransitions.length === 0 || pending}
              onValueChange={(s) => s !== ticket.status && onPatch({ status: s as TicketDetailDto['status'] })}
            >
              <SelectTrigger aria-label="Đổi trạng thái" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_META[s]?.label ?? s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row label="Priority">
            {ticket.canChangePriority ? (
              <Select
                value={ticket.priority}
                disabled={pending}
                onValueChange={(p) => p !== ticket.priority && onPatch({ priority: p as TicketDetailDto['priority'] })}
              >
                <SelectTrigger aria-label="Đổi ưu tiên" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_META[p].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <PriorityBadge priority={ticket.priority} />
            )}
          </Row>
          <Row label="Category">{ticket.category.name}</Row>
          <Row label="Assignee">
            {ticket.canAssign ? (
              <Combobox
                aria-label="Gán người xử lý"
                placeholder="Chưa gán"
                searchPlaceholder="Tìm nhân viên..."
                allowClear
                clearLabel="Bỏ gán"
                loading={assignees.isLoading}
                disabled={pending}
                value={ticket.assignee?.id}
                options={agentOptions}
                onChange={(v) => {
                  if (!v) {
                    if (ticket.assignee) onPatch({ unassign: true });
                  } else if (v !== ticket.assignee?.id) {
                    onPatch({ assigneeId: v });
                  }
                }}
              />
            ) : (
              (ticket.assignee?.fullName ?? <span className="text-muted-foreground">Chưa gán</span>)
            )}
          </Row>
          <Row label="Created by">{ticket.createdBy.fullName}</Row>
          <Row label="Created">{formatDateTime(ticket.createdAt)}</Row>
          {ticket.responseDueAt && !ticket.firstRespondedAt && (
            <Row label="Phản hồi trước">{formatDateTime(ticket.responseDueAt)}</Row>
          )}
          <Row label="SLA">
            <SlaDue ticket={ticket} />
          </Row>
          {ticket.resolvedAt && <Row label="Resolved">{formatDateTime(ticket.resolvedAt)}</Row>}
          {ticket.closedAt && <Row label="Closed">{formatDateTime(ticket.closedAt)}</Row>}
        </dl>
      </CardContent>
    </Card>
  );
}
