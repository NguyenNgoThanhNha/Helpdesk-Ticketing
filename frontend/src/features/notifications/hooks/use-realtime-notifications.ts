import { useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/query-client';
import { HUB_EVENTS, useRealtimeEvent, useRealtimeReconnected } from '@/lib/realtime';
import type { NotificationDto } from '@/types';
import { useMarkRead } from './use-notifications';

/** Same size as the bell's list request (`take=20`). */
const LIST_SIZE = 20;

/**
 * A request that started before the notification existed could overwrite the optimistic update, so an in-flight
 * request for a loaded query is cancelled (its data is kept). A query without data is refetched instead.
 */
async function settle(queryClient: QueryClient, queryKey: QueryKey): Promise<boolean> {
  if (queryClient.getQueryData(queryKey) === undefined) {
    void queryClient.invalidateQueries({ queryKey, exact: true });
    return false;
  }
  await queryClient.cancelQueries({ queryKey, exact: true });
  return true;
}

/** Optimistically adds a pushed notification: +1 unread, prepended to the bell's list. */
export async function applyPushedNotification(queryClient: QueryClient, n: NotificationDto) {
  const [hasCount, hasList] = await Promise.all([
    settle(queryClient, queryKeys.unreadCount),
    settle(queryClient, queryKeys.notificationList),
  ]);
  const list = queryClient.getQueryData<NotificationDto[]>(queryKeys.notificationList);
  const known = !!list?.some((x) => x.id === n.id);
  if (hasCount && !known && !n.isRead) {
    queryClient.setQueryData<number>(queryKeys.unreadCount, (c) => (c ?? 0) + 1);
  }
  if (hasList && !known) {
    queryClient.setQueryData<NotificationDto[]>(queryKeys.notificationList, (prev) => [n, ...(prev ?? [])].slice(0, LIST_SIZE));
  }
}

/**
 * Handles the hub's `notification` event (bump the badge, prepend to the list, toast with a link to the ticket) and
 * refetches notifications after a reconnect. Mount once, in the authenticated layout.
 */
export function useRealtimeNotifications() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const markRead = useMarkRead();

  useRealtimeEvent<NotificationDto>(HUB_EVENTS.notification, (n) => {
    void applyPushedNotification(queryClient, n);
    toast(n.message, {
      id: `notification:${n.id}`,
      action: n.ticketId
        ? {
            label: 'Xem ticket',
            onClick: () => {
              if (!n.isRead) markRead.mutate(n.id);
              navigate(`/tickets/${n.ticketId}`);
            },
          }
        : undefined,
    });
  });

  // missed while offline
  useRealtimeReconnected(() => void queryClient.invalidateQueries({ queryKey: queryKeys.notifications }));
}
