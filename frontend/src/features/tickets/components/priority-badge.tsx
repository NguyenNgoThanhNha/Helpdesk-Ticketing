import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TicketPriority } from '@/types';
import { PRIORITY_META } from './ticket-meta';

export function PriorityBadge({ priority, className }: { priority: TicketPriority; className?: string }) {
  const meta = PRIORITY_META[priority] ?? { label: priority, className: '' };
  return (
    <Badge
      variant="outline"
      data-testid="priority-badge"
      data-priority={priority}
      className={cn(meta.className, className)}
    >
      {meta.label}
    </Badge>
  );
}
