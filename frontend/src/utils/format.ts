import dayjs from 'dayjs';

export const formatDateTime = (value: string | null | undefined) =>
  value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '—';

export const formatDate = (value: string | null | undefined) => (value ? dayjs(value).format('DD/MM/YYYY') : '—');

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function humanizeMinutes(totalMinutes: number): string {
  const minutes = Math.abs(Math.round(totalMinutes));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest && hours < 10 ? `${hours}h${rest}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours ? `${days}d ${restHours}h` : `${days}d`;
}

/** "còn 2h" / "quá hạn 3h" relative to now. */
export function slaCountdown(dueAt: string | null | undefined, now: dayjs.Dayjs = dayjs()): string | null {
  if (!dueAt) return null;
  const diff = dayjs(dueAt).diff(now, 'minute', true);
  return diff >= 0 ? `còn ${humanizeMinutes(diff)}` : `quá hạn ${humanizeMinutes(diff)}`;
}

/** Saves a Blob to disk via a temporary object URL. */
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const MAX_FILE_SIZE = 10 * 1024 * 1024;
