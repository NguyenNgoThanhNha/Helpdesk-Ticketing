import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { categoriesApi, ticketsApi, usersApi } from '@/api/endpoints';
import { queryKeys } from '@/api/queryClient';
import { useCanAny } from '@/stores/authStore';
import type { CreateTicketRequest, TicketsQuery, UpdateTicketRequest } from '@/types';

export function useCategories() {
  return useQuery({ queryKey: queryKeys.categories, queryFn: categoriesApi.list, staleTime: 5 * 60_000 });
}

/** Users that can be assigned (TICKET_ASSIGN:R) — for the Assign dropdown and Assignee filter. */
export function useAssignees() {
  const allowed = useCanAny([
    ['TICKET_ASSIGN', 'U'],
    ['TICKET', 'R'],
  ]);
  return useQuery({
    queryKey: queryKeys.assignees,
    queryFn: usersApi.assignees,
    enabled: allowed,
    staleTime: 5 * 60_000,
  });
}

export function useTickets(query: TicketsQuery) {
  return useQuery({
    queryKey: queryKeys.ticketList(query),
    queryFn: () => ticketsApi.list(query),
    placeholderData: keepPreviousData,
  });
}

export function useTicket(id: number) {
  return useQuery({
    queryKey: queryKeys.ticket(id),
    queryFn: () => ticketsApi.get(id),
    enabled: Number.isFinite(id) && id > 0,
  });
}

export function useTicketHistory(id: number) {
  return useQuery({
    queryKey: queryKeys.ticketHistory(id),
    queryFn: () => ticketsApi.history(id),
    enabled: Number.isFinite(id) && id > 0,
  });
}

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
