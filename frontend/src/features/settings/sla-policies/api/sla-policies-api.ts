import { api } from '@/lib/api-client';
import type { SlaPolicyDto, SlaPolicyRequest, TicketPriority } from '@/types';

export const slaPoliciesApi = {
  list: () => api.get<SlaPolicyDto[]>('/sla-policies').then((r) => r.data),
  update: (priority: TicketPriority, body: SlaPolicyRequest) =>
    api.put<SlaPolicyDto>(`/sla-policies/${priority}`, body).then((r) => r.data),
};
