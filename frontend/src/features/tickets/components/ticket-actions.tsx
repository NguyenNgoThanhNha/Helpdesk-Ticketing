import { UserRound } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/common/combobox';
import { cn } from '@/lib/utils';
import { TICKET_PRIORITIES, type TicketDetailDto, type TicketPriority, type TicketStatus, type UpdateTicketRequest } from '@/types';
import { useAssignees } from '../hooks/use-lookups';
import { PriorityBadge } from './priority-badge';
import { StatusBadge } from './status-badge';
import { PRIORITY_META, STATUS_META, TICKET_FIELD_LABEL as F } from './ticket-meta';

export interface TicketActionsProps {
  ticket: TicketDetailDto;
  pending: boolean;
  onPatch: (changes: Omit<UpdateTicketRequest, 'rowVersion'>) => void;
}

/** On phones every control takes half a row (the assignee wraps to a full row); from `sm` they size to content. */
const CONTROL = 'min-w-36 flex-1 sm:flex-none';

function FieldPrefix({ children }: { children: string }) {
  return <span className="text-muted-foreground">{children}:</span>;
}

/**
 * Header actions of the ticket detail page ("[Assign▾][Status▾]" in the spec wireframe): status / priority / assignee
 * editors, gated by the flags the API returns. Fields the user cannot change are shown read-only.
 */
export function TicketActions({ ticket, pending, onPatch }: TicketActionsProps) {
  const assignees = useAssignees();
  const canChangeStatus = ticket.allowedTransitions.length > 0;
  const statusOptions = [ticket.status, ...ticket.allowedTransitions.filter((s) => s !== ticket.status)];

  const agentOptions = (assignees.data ?? []).map((a) => ({ value: a.id, label: a.fullName }));
  if (ticket.assignee && !agentOptions.some((o) => o.value === ticket.assignee?.id)) {
    agentOptions.unshift({ value: ticket.assignee.id, label: ticket.assignee.fullName });
  }

  return (
    <div role="group" aria-label="Thao tác ticket" className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      {canChangeStatus ? (
        <Select
          value={ticket.status}
          disabled={pending}
          onValueChange={(s) => s !== ticket.status && onPatch({ status: s as TicketStatus })}
        >
          <SelectTrigger aria-label="Đổi trạng thái" className={CONTROL}>
            <FieldPrefix>{F.status}</FieldPrefix>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((s) => (
              <SelectItem key={s} value={s}>
                <span aria-hidden className={cn('size-1.5 rounded-full', STATUS_META[s]?.dot)} />
                {STATUS_META[s]?.label ?? s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <StatusBadge status={ticket.status} className="h-8 px-3 text-sm" />
      )}

      {ticket.canChangePriority ? (
        <Select
          value={ticket.priority}
          disabled={pending}
          onValueChange={(p) => p !== ticket.priority && onPatch({ priority: p as TicketPriority })}
        >
          <SelectTrigger aria-label="Đổi ưu tiên" className={CONTROL}>
            <FieldPrefix>{F.priority}</FieldPrefix>
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
        <PriorityBadge priority={ticket.priority} className="h-8 px-3 text-sm" />
      )}

      {ticket.canAssign ? (
        <Combobox
          aria-label="Gán người xử lý"
          className={cn(CONTROL, 'min-w-full sm:w-60 sm:min-w-0')}
          prefix={`${F.assignee}:`}
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
        <span className="inline-flex h-8 items-center gap-1.5 text-sm" data-testid="assignee">
          <UserRound className="size-4 text-muted-foreground" aria-hidden />
          <FieldPrefix>{F.assignee}</FieldPrefix>
          {ticket.assignee?.fullName ?? <span className="text-muted-foreground">Chưa gán</span>}
        </span>
      )}
    </div>
  );
}
