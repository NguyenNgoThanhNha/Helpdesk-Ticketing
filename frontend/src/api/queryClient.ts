import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { getStatus, showError } from './errors';

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: { suppressGlobalError?: boolean };
    mutationMeta: { suppressGlobalError?: boolean };
  }
}

export function createQueryClient(options: { retry?: boolean } = {}) {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        // 401s are handled by the axios interceptor (refresh / logout)
        if (query.meta?.suppressGlobalError || getStatus(error) === 401) return;
        showError(error);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _vars, _ctx, mutation) => {
        if (mutation.meta?.suppressGlobalError || getStatus(error) === 401) return;
        showError(error);
      },
    }),
    defaultOptions: {
      queries: {
        retry: options.retry === false ? false : (count, error) => {
          const status = getStatus(error);
          if (status && status >= 400 && status < 500) return false;
          return count < 2;
        },
        refetchOnWindowFocus: false,
        staleTime: 15_000,
      },
      mutations: { retry: false },
    },
  });
}

export const queryKeys = {
  tickets: ['tickets'] as const,
  ticketList: (params: object) => ['tickets', 'list', params] as const,
  ticket: (id: number) => ['tickets', 'detail', id] as const,
  ticketHistory: (id: number) => ['tickets', 'history', id] as const,
  categories: ['categories'] as const,
  assignees: ['users', 'assignees'] as const,
  userPermissions: (id: string) => ['users', 'permissions', id] as const,
  roles: ['roles'] as const,
  role: (id: string) => ['roles', id] as const,
  activities: ['activities'] as const,
  me: ['auth', 'me'] as const,
  users: (params: object) => ['users', 'list', params] as const,
  slaPolicies: ['sla-policies'] as const,
  notifications: ['notifications'] as const,
  notificationList: ['notifications', 'list'] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
  reportSummary: (params: object) => ['reports', 'summary', params] as const,
};
