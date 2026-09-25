import { Headset, User } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { EmptyState } from '@/components/common/empty-state';
import { formatDateTime, fromNow } from '@/lib/date';
import { cn } from '@/lib/utils';
import type { AttachmentDto, TicketDetailDto } from '@/types';
import { AttachmentLink } from './attachment-link';
import { ReplyBox } from './reply-box';

/** Badge telling whether a message comes from the ticket requester or from support staff. */
export function AuthorBadge({ isRequester }: { isRequester: boolean }) {
  return isRequester ? (
    <Badge variant="secondary">Khách hàng</Badge>
  ) : (
    <Badge className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300" variant="outline">
      Nhân viên hỗ trợ
    </Badge>
  );
}

function Message({
  ticketId,
  author,
  isRequester,
  createdAt,
  body,
  attachments,
}: {
  ticketId: number;
  author: string;
  isRequester: boolean;
  createdAt: string;
  body: string;
  attachments: AttachmentDto[];
}) {
  return (
    <div data-testid="comment" className="flex gap-3">
      <Avatar className="mt-0.5">
        <AvatarFallback className={cn(!isRequester && 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300')}>
          {isRequester ? <User className="size-4" /> : <Headset className="size-4" />}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-medium">{author}</span>
          <AuthorBadge isRequester={isRequester} />
          <span className="text-muted-foreground" title={formatDateTime(createdAt)}>
            · {fromNow(createdAt)}
          </span>
        </div>
        <div className="text-sm break-words whitespace-pre-wrap">{body}</div>
        {attachments.length > 0 && (
          <div className="flex flex-col items-start">
            {attachments.map((a) => (
              <AttachmentLink key={a.id} ticketId={ticketId} attachment={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Description + conversation timeline + reply box. */
export function CommentThread({ ticket }: { ticket: TicketDetailDto }) {
  const ticketAttachments = ticket.attachments.filter((a) => a.commentId === null);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Mô tả</CardTitle>
        </CardHeader>
        <CardContent>
          <Message
            ticketId={ticket.id}
            author={ticket.createdBy.fullName}
            isRequester
            createdAt={ticket.createdAt}
            body={ticket.description}
            attachments={ticketAttachments}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trao đổi ({ticket.comments.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {ticket.comments.length === 0 ? (
            <EmptyState title="Chưa có trao đổi" className="py-6" />
          ) : (
            <div className="space-y-4">
              {ticket.comments.map((c, i) => (
                <div key={c.id} className="space-y-4">
                  {i > 0 && <Separator />}
                  <Message
                    ticketId={ticket.id}
                    author={c.author.fullName}
                    isRequester={c.isFromRequester}
                    createdAt={c.createdAt}
                    body={c.body}
                    attachments={c.attachments}
                  />
                </div>
              ))}
            </div>
          )}
          <Separator />
          {ticket.canComment ? (
            <ReplyBox ticketId={ticket.id} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {ticket.status === 'Closed' ? 'Ticket đã đóng, không thể trả lời.' : 'Bạn không có quyền trả lời ticket này.'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
