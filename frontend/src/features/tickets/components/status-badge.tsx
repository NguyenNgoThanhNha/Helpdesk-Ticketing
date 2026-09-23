import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TicketStatus } from '@/types';
import { STATUS_META } from './ticket-meta';

export function StatusBadge({ status, className }: { status: TicketStatus; className?: string }) {
  const meta = STATUS_META[status] ?? { label: status, className: '', dot: 'bg-zinc-400' };
  return (
    <Badge variant="outline" data-testid="status-badge" data-status={status} className={cn(meta.className, className)}>
      <span aria-hidden className={cn('size-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </Badge>
  );
}
