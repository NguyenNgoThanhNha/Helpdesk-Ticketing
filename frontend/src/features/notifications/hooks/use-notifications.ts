import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';
import { notificationsApi } from '../api/notifications-api';

export const UNREAD_POLL_INTERVAL = 30_000;

/** Unread badge count, polled every 30s. */
export function useUnreadCount() {
  return useQuery({
    queryKey: queryKeys.unreadCount,
    queryFn: notificationsApi.unreadCount,
    refetchInterval: UNREAD_POLL_INTERVAL,
    meta: { suppressGlobalError: true },
  });
}

export function useNotificationList(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.notificationList,
    queryFn: () => notificationsApi.list({ take: 20 }),
    enabled,
    staleTime: 0,
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}
