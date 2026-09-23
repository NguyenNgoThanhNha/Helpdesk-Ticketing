import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';
import { useCanAny } from '@/stores/auth-store';
import { lookupsApi } from '../api/tickets-api';

export function useCategories() {
  return useQuery({ queryKey: queryKeys.categories, queryFn: lookupsApi.categories, staleTime: 5 * 60_000 });
}

/** Users that can be assigned (TICKET_ASSIGN:R) — for the Assign dropdown and Assignee filter. */
export function useAssignees() {
  const allowed = useCanAny([
    ['TICKET_ASSIGN', 'U'],
    ['TICKET', 'R'],
  ]);
  return useQuery({
    queryKey: queryKeys.assignees,
    queryFn: lookupsApi.assignees,
    enabled: allowed,
    staleTime: 5 * 60_000,
  });
}
