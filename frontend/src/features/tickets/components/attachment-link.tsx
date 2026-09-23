import { useState } from 'react';
import { Loader2, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { showError } from '@/lib/api-errors';
import { formatFileSize, saveBlob } from '@/lib/file';
import type { AttachmentDto } from '@/types';
import { ticketsApi } from '../api/tickets-api';

/** Downloads through axios (the Authorization header is required), then triggers a browser download. */
export function AttachmentLink({ ticketId, attachment }: { ticketId: number; attachment: AttachmentDto }) {
  const [loading, setLoading] = useState(false);

  const download = async () => {
    setLoading(true);
    try {
      const blob = await ticketsApi.downloadAttachment(ticketId, attachment.id);
      saveBlob(blob, attachment.fileName);
    } catch (err) {
      showError(err, 'Không tải được file');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="link" size="sm" className="h-auto px-0" disabled={loading} onClick={() => void download()}>
      {loading ? <Loader2 className="animate-spin" /> : <Paperclip />}
      {attachment.fileName}
      <span className="text-muted-foreground">({formatFileSize(attachment.size)})</span>
    </Button>
  );
}
