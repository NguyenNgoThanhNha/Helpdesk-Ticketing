import { api, cleanParams } from '@/lib/api-client';
import type {
  AttachmentDto,
  CategoryDto,
  CommentDto,
  CreateTicketRequest,
  PagedResult,
  TicketDetailDto,
  TicketHistoryDto,
  TicketListItemDto,
  TicketsQuery,
  UpdateTicketRequest,
  UserSummaryDto,
} from '@/types';

export const ticketsApi = {
  list: (query: TicketsQuery) =>
    api.get<PagedResult<TicketListItemDto>>('/tickets', { params: cleanParams(query) }).then((r) => r.data),
  get: (id: number) => api.get<TicketDetailDto>(`/tickets/${id}`).then((r) => r.data),
  create: (body: CreateTicketRequest) => api.post<TicketDetailDto>('/tickets', body).then((r) => r.data),
  update: (id: number, body: UpdateTicketRequest) =>
    api.patch<TicketDetailDto>(`/tickets/${id}`, body).then((r) => r.data),
  addComment: (id: number, body: string) =>
    api.post<CommentDto>(`/tickets/${id}/comments`, { body }).then((r) => r.data),
  uploadAttachment: (id: number, file: File, commentId?: number) => {
    const form = new FormData();
    form.append('file', file);
    if (commentId !== undefined) form.append('commentId', String(commentId));
    return api.post<AttachmentDto>(`/tickets/${id}/attachments`, form).then((r) => r.data);
  },
  downloadAttachment: (id: number, attachmentId: number) =>
    api.get<Blob>(`/tickets/${id}/attachments/${attachmentId}`, { responseType: 'blob' }).then((r) => r.data),
  history: (id: number) => api.get<TicketHistoryDto[]>(`/tickets/${id}/history`).then((r) => r.data),
};

/** Read-only lookups used by ticket forms and filters. */
export const lookupsApi = {
  categories: () => api.get<CategoryDto[]>('/categories').then((r) => r.data),
  /** active users with TICKET_ASSIGN:R (Assign dropdown / Assignee filter) */
  assignees: () => api.get<UserSummaryDto[]>('/users/assignees').then((r) => r.data),
};
