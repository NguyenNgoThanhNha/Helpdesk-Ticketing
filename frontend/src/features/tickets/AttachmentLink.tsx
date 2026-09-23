import { useState } from 'react';
import { Button } from 'antd';
import { PaperClipOutlined } from '@ant-design/icons';
import { ticketsApi } from '@/api/endpoints';
import { showError } from '@/api/errors';
import type { AttachmentDto } from '@/types';
import { formatFileSize, saveBlob } from '@/utils/format';

/** Downloads through axios (auth header required), then triggers a browser download. */
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
    <Button
      type="link"
      size="small"
      icon={<PaperClipOutlined />}
      loading={loading}
      onClick={() => void download()}
      style={{ paddingInline: 0 }}
    >
      {attachment.fileName} ({formatFileSize(attachment.size)})
    </Button>
  );
}
