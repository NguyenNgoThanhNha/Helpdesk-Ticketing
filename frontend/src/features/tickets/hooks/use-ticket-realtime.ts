import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/query-client';
import {
  HUB_EVENTS,
  HUB_METHODS,
  isHubForbidden,
  realtime,
  useRealtimeEvent,
  useRealtimeReconnected,
  useRealtimeState,
} from '@/lib/realtime';
import { useCurrentUser } from '@/stores/auth-store';
import type { TicketChangedEvent } from '@/types';

export const TICKET_CHANGED_MESSAGE = 'Ticket vừa được người khác cập nhật';

/**
 * Live updates for an open ticket:
 * - joins the ticket's hub group on mount and whenever the connection is (re)established, leaves it on unmount;
 * - on `ticketChanged` made by someone else (or by the system), refetches the detail + history and shows a subtle toast;
 * - after a reconnect, refetches silently (changes may have been missed while offline).
 */
export function useTicketRealtime(ticketId: number, enabled = true) {
  const queryClient = useQueryClient();
  const currentUserId = useCurrentUser()?.id;
  const { status, epoch } = useRealtimeState();
  const connected = status === 'connected';

  useEffect(() => {
    if (!enabled || !connected) return;
    realtime.invoke(HUB_METHODS.joinTicket, ticketId).catch((error: unknown) => {
      // no permission to watch this ticket: simply no live updates (the page itself shows the 403)
      if (!isHubForbidden(error)) console.warn('[realtime] JoinTicket failed', error);
    });
    return () => {
      // after a disconnect the server already dropped the group membership
      if (realtime.getState().status === 'connected') {
        realtime.invoke(HUB_METHODS.leaveTicket, ticketId).catch(() => undefined);
      }
    };
  }, [ticketId, enabled, connected, epoch]);

  const refetch = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.ticket(ticketId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.ticketHistory(ticketId) });
  };

  useRealtimeEvent<TicketChangedEvent>(HUB_EVENTS.ticketChanged, (event) => {
    if (!enabled || event.ticketId !== ticketId) return;
    if (currentUserId && event.actorId === currentUserId) return; // our own change is already applied
    refetch();
    // one toast per ticket even when several changes arrive together
    toast(TICKET_CHANGED_MESSAGE, { id: `ticket-changed:${ticketId}` });
  });

  useRealtimeReconnected(() => {
    if (enabled) refetch();
  });
}
