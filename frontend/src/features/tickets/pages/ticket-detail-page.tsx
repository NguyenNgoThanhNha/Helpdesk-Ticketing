import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FileQuestion, ShieldX, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/empty-state';
import { getStatus, showError } from '@/lib/api-errors';
import type { UpdateTicketRequest } from '@/types';
import { CommentThread } from '../components/comment-thread';
import { HistoryTimeline } from '../components/history-timeline';
import { PriorityBadge } from '../components/priority-badge';
import { StatusBadge } from '../components/status-badge';
import { TicketSidebar } from '../components/ticket-sidebar';
import { useTicket, useTicketHistory, useUpdateTicket } from '../hooks/use-tickets';

export const CONFLICT_MESSAGE = 'Ticket đã được người khác cập nhật, đang tải lại';

const backToList = (
  <Button variant="outline" asChild>
    <Link to="/tickets">Về danh sách</Link>
  </Button>
);

export function TicketDetailPage() {
  const { id: idParam } = useParams();
  const id = Number(idParam);

  const ticketQuery = useTicket(id);
  const historyQuery = useTicketHistory(id);
  const update = useUpdateTicket(id);
  const ticket = ticketQuery.data;

  const patch = (changes: Omit<UpdateTicketRequest, 'rowVersion'>) => {
    if (!ticket) return;
    update.mutate(
      { rowVersion: ticket.rowVersion, ...changes },
      {
        onSuccess: () => toast.success('Đã cập nhật ticket'),
        onError: (err) => {
          if (getStatus(err) === 409) {
            toast.warning(CONFLICT_MESSAGE);
            void ticketQuery.refetch();
            void historyQuery.refetch();
          } else {
            showError(err);
          }
        },
      },
    );
  };

  if (!Number.isInteger(id) || id <= 0) {
    return <EmptyState icon={<FileQuestion />} title="Ticket không hợp lệ" action={backToList} />;
  }
  if (ticketQuery.isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-3" aria-busy>
        <Card className="lg:col-span-2">
          <CardContent className="space-y-3">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      </div>
    );
  }
  if (ticketQuery.isError || !ticket) {
    const status = getStatus(ticketQuery.error);
    return (
      <EmptyState
        icon={status === 403 ? <ShieldX /> : status === 404 ? <FileQuestion /> : <TriangleAlert />}
        title={status === 404 ? 'Không tìm thấy ticket' : status === 403 ? 'Không có quyền xem ticket' : 'Lỗi tải ticket'}
        action={backToList}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Quay lại" asChild>
          <Link to="/tickets">
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="min-w-0 text-xl font-semibold tracking-tight break-words">
          Ticket #{ticket.id} — {ticket.title}
        </h1>
        <StatusBadge status={ticket.status} />
        <PriorityBadge priority={ticket.priority} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <CommentThread ticket={ticket} />
        </div>
        <div className="min-w-0 space-y-4">
          <TicketSidebar ticket={ticket} pending={update.isPending} onPatch={patch} />
          <HistoryTimeline items={historyQuery.data} loading={historyQuery.isLoading} />
        </div>
      </div>
    </div>
  );
}
