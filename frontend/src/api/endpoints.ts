import { api } from './client';
import type {
  AttachmentDto,
  AuthResponse,
  CategoryDto,
  CategoryRequest,
  CommentDto,
  CreateTicketRequest,
  LoginRequest,
  NotificationDto,
  PagedResult,
  RegisterRequest,
  ReportSummaryDto,
  ResetPasswordRequest,
  SlaPolicyDto,
  SlaPolicyRequest,
  TicketDetailDto,
  TicketHistoryDto,
  TicketListItemDto,
  TicketPriority,
  TicketsQuery,
  UpdateTicketRequest,
  UpdateUserRequest,
  UserListItemDto,
  UserPermissionDetailDto,
  ActivityDto,
  ActivityPermissionInput,
  RoleDetailDto,
  RoleDto,
  RoleRequest,
  CurrentUserDto,
  UserSummaryDto,
  UsersQuery,
} from '@/types';

/** Drops undefined / null / empty-string values so they are not sent as query params. */
function clean<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  ) as Partial<T>;
}

export const authApi = {
  login: (body: LoginRequest) => api.post<AuthResponse>('/auth/login', body).then((r) => r.data),
  register: (body: RegisterRequest) => api.post<AuthResponse>('/auth/register', body).then((r) => r.data),
  logout: (refreshToken: string) => api.post<void>('/auth/logout', { refreshToken }).then(() => undefined),
  forgotPassword: (email: string) => api.post<void>('/auth/forgot-password', { email }).then(() => undefined),
  resetPassword: (body: ResetPasswordRequest) =>
    api.post<void>('/auth/reset-password', body).then(() => undefined),
  me: () => api.get<CurrentUserDto>('/auth/me').then((r) => r.data),
};

export const ticketsApi = {
  list: (query: TicketsQuery) =>
    api.get<PagedResult<TicketListItemDto>>('/tickets', { params: clean(query) }).then((r) => r.data),
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
    api
      .get<Blob>(`/tickets/${id}/attachments/${attachmentId}`, { responseType: 'blob' })
      .then((r) => r.data),
  history: (id: number) => api.get<TicketHistoryDto[]>(`/tickets/${id}/history`).then((r) => r.data),
};

export const categoriesApi = {
  list: () => api.get<CategoryDto[]>('/categories').then((r) => r.data),
  create: (body: CategoryRequest) => api.post<CategoryDto>('/categories', body).then((r) => r.data),
  update: (id: number, body: CategoryRequest) =>
    api.put<CategoryDto>(`/categories/${id}`, body).then((r) => r.data),
};

export const usersApi = {
  assignees: () => api.get<UserSummaryDto[]>('/users/assignees').then((r) => r.data),
  list: (query: UsersQuery) =>
    api.get<PagedResult<UserListItemDto>>('/users', { params: clean(query) }).then((r) => r.data),
  update: (id: string, body: UpdateUserRequest) =>
    api.patch<UserListItemDto>(`/users/${id}`, body).then((r) => r.data),
  setRoles: (id: string, roleIds: string[]) =>
    api.put<UserListItemDto>(`/users/${id}/roles`, { roleIds }).then((r) => r.data),
  getPermissions: (id: string) =>
    api.get<UserPermissionDetailDto>(`/users/${id}/permissions`).then((r) => r.data),
  setPermissions: (id: string, activities: ActivityPermissionInput[]) =>
    api.put<UserPermissionDetailDto>(`/users/${id}/permissions`, { activities }).then((r) => r.data),
};

export const rolesApi = {
  list: () => api.get<RoleDto[]>('/roles').then((r) => r.data),
  get: (id: string) => api.get<RoleDetailDto>(`/roles/${id}`).then((r) => r.data),
  create: (body: RoleRequest) => api.post<RoleDetailDto>('/roles', body).then((r) => r.data),
  update: (id: string, body: RoleRequest) => api.put<RoleDetailDto>(`/roles/${id}`, body).then((r) => r.data),
  remove: (id: string) => api.delete<void>(`/roles/${id}`).then(() => undefined),
};

export const activitiesApi = {
  list: () => api.get<ActivityDto[]>('/activities').then((r) => r.data),
};

export const slaApi = {
  list: () => api.get<SlaPolicyDto[]>('/sla-policies').then((r) => r.data),
  update: (priority: TicketPriority, body: SlaPolicyRequest) =>
    api.put<SlaPolicyDto>(`/sla-policies/${priority}`, body).then((r) => r.data),
};

export const notificationsApi = {
  list: (params: { unreadOnly?: boolean; take?: number } = {}) =>
    api.get<NotificationDto[]>('/notifications', { params: clean(params) }).then((r) => r.data),
  unreadCount: () => api.get<{ count: number }>('/notifications/unread-count').then((r) => r.data.count),
  markRead: (id: number) => api.post<void>(`/notifications/${id}/read`).then(() => undefined),
  markAllRead: () => api.post<void>('/notifications/read-all').then(() => undefined),
};

export const reportsApi = {
  summary: (params: { from?: string; to?: string }) =>
    api.get<ReportSummaryDto>('/reports/summary', { params: clean(params) }).then((r) => r.data),
};
