import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { priorityLabel } from '@/lib/labels';
import { queryKeys } from '@/lib/query-client';
import type { TicketPriority } from '@/types';
import { slaPoliciesApi } from '../api/sla-policies-api';

export function useSlaPolicies() {
  return useQuery({ queryKey: queryKeys.slaPolicies, queryFn: slaPoliciesApi.list });
}

export function useUpdateSlaPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      priority,
      responseHours,
      resolveHours,
    }: {
      priority: TicketPriority;
      responseHours: number;
      resolveHours: number;
    }) => slaPoliciesApi.update(priority, { responseHours, resolveHours }),
    onSuccess: (p) => {
      toast.success(`Đã lưu SLA cho mức ưu tiên ${priorityLabel(p.priority)}`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.slaPolicies });
    },
  });
}
