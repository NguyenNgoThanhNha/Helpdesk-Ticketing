import { useCallback, useEffect, useRef } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';
import type { CreateTicketRequest, TicketsQuery, UpdateTicketRequest } from '@/types';
import { ticketsApi } from '../api/tickets-api';

const validId = (id: number) => Number.isFinite(id) && id > 0;

export function useTickets(query: TicketsQuery) {
  return useQuery({
    queryKey: queryKeys.ticketList(query),
    queryFn: () => ticketsApi.list(query),
    placeholderData: keepPreviousData,
  });
}

/** How long a hover must rest on a row before its detail is prefetched (skips rows the pointer just sweeps over). */
export const PREFETCH_INTENT_MS = 120;
/** Prefetched detail counts as fresh for this long, so opening it right after hovering needs no request. */
const PREFETCH_STALE_MS = 30_000;

/**
 * Returns `prefetch(id)` for list rows: after a short hover / focus intent it warms the cache with the ticket
 * detail + history, so the detail page renders without a spinner. Only the latest hovered row is prefetched.
 */
export function usePrefetchTicket() {
  const queryClient = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  return useCallback(
    (id: number) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void queryClient.prefetchQuery({
          queryKey: queryKeys.ticket(id),
          queryFn: () => ticketsApi.get(id),
          staleTime: PREFETCH_STALE_MS,
          meta: { suppressGlobalError: true },
        });
        void queryClient.prefetchQuery({
          queryKey: queryKeys.ticketHistory(id),
          queryFn: () => ticketsApi.history(id),
          staleTime: PREFETCH_STALE_MS,
          meta: { suppressGlobalError: true },
        });
      }, PREFETCH_INTENT_MS);
    },
    [queryClient],
  );
}

export function useTicket(id: number) {
  return useQuery({ queryKey: queryKeys.ticket(id), queryFn: () => ticketsApi.get(id), enabled: validId(id) });
}

export function useTicketHistory(id: number) {
  return useQuery({
    queryKey: queryKeys.ticketHistory(id),
    queryFn: () => ticketsApi.history(id),
    enabled: validId(id),
    // the ticket query already reports 403/404 for the page; don't toast twice
    meta: { suppressGlobalError: true },
  });
}

/** Creates the ticket, then uploads attachments one by one (failures are reported, not fatal). */
export function useCreateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, files }: { body: CreateTicketRequest; files: File[] }) => {
      const ticket = await ticketsApi.create(body);
      const failed: string[] = [];
      for (const file of files) {
        try {
          await ticketsApi.uploadAttachment(ticket.id, file);
        } catch {
          failed.push(file.name);
        }
      }
      return { ticket, failed };
    },
    meta: { suppressGlobalError: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tickets }),
  });
}

export function useUpdateTicket(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateTicketRequest) => ticketsApi.update(id, body),
    meta: { suppressGlobalError: true },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.ticket(id), data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.ticketHistory(id) });
      void queryClient.invalidateQueries({ queryKey: ['tickets', 'list'] });
    },
  });
}

export function useAddComment(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, files }: { body: string; files: File[] }) => {
      const comment = await ticketsApi.addComment(id, body);
      for (const file of files) {
        await ticketsApi.uploadAttachment(id, file, comment.id);
      }
      return comment;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.ticket(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.ticketHistory(id) });
    },
  });
}
