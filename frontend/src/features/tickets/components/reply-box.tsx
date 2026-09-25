import { useState } from 'react';
import { Loader2, SendHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FilePicker } from '@/components/common/file-picker';
import { useAddComment } from '../hooks/use-tickets';

export function ReplyBox({ ticketId }: { ticketId: number }) {
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const addComment = useAddComment(ticketId);

  const send = () => {
    const text = body.trim();
    if (!text) {
      toast.warning('Vui lòng nhập nội dung trả lời');
      return;
    }
    addComment.mutate(
      { body: text, files },
      {
        onSuccess: () => {
          setBody('');
          setFiles([]);
          toast.success('Đã gửi trả lời');
        },
      },
    );
  };

  return (
    <div className="space-y-2">
      <Textarea
        aria-label="Nội dung trả lời"
        placeholder="Nhập trả lời..."
        rows={4}
        className="min-h-24"
        value={body}
        maxLength={4000}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send();
        }}
        disabled={addComment.isPending}
      />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <FilePicker files={files} onChange={setFiles} disabled={addComment.isPending} label="Đính kèm" />
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted-foreground sm:inline">Ctrl + Enter để gửi</span>
          <Button onClick={send} disabled={addComment.isPending}>
            {addComment.isPending ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
            Gửi
          </Button>
        </div>
      </div>
    </div>
  );
}
