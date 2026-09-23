import type {
  ActivityDto,
  ApiLogDetailDto,
  ApiLogListItemDto,
  AuthResponse,
  CategoryDto,
  CurrentUserDto,
  PermissionDto,
  TicketDetailDto,
  TicketListItemDto,
  UserSummaryDto,
} from '@/types';

const perm = (code: string, flags: string): PermissionDto => ({
  code,
  c: flags.includes('C'),
  r: flags.includes('R'),
  u: flags.includes('U'),
  d: flags.includes('D'),
});

export const adminUser: CurrentUserDto = {
  id: '00000000-0000-0000-0000-00000000a001',
  email: 'admin@helpdesk.local',
  fullName: 'Admin',
  isAdmin: true,
  roles: ['Admin'],
  permissions: [],
};

/** Seed "Agent" role: TICKET CRUD, TICKET_ASSIGN RU, COMMENT C, REPORT R */
export const agentUser: CurrentUserDto = {
  id: '00000000-0000-0000-0000-00000000a002',
  email: 'an.agent@helpdesk.local',
  fullName: 'An Agent',
  isAdmin: false,
  roles: ['Agent'],
  permissions: [perm('TICKET', 'CRUD'), perm('TICKET_ASSIGN', 'RU'), perm('COMMENT', 'C'), perm('REPORT', 'R')],
};

/** Seed "Customer" role: TICKET C, COMMENT C */
export const customerUser: CurrentUserDto = {
  id: '00000000-0000-0000-0000-00000000a003',
  email: 'customer@helpdesk.local',
  fullName: 'Khách Hàng',
  isAdmin: false,
  roles: ['Customer'],
  permissions: [perm('TICKET', 'C'), perm('COMMENT', 'C')],
};

export const assignees: UserSummaryDto[] = [
  { id: agentUser.id, fullName: 'An Agent' },
  { id: '00000000-0000-0000-0000-00000000a004', fullName: 'Bình Agent' },
];

export const activities: ActivityDto[] = [
  { id: 'act-ticket', code: 'TICKET', name: 'Ticket', description: null },
  { id: 'act-comment', code: 'COMMENT', name: 'Bình luận', description: null },
  { id: 'act-report', code: 'REPORT', name: 'Báo cáo', description: null },
];

export const categories: CategoryDto[] = [
  { id: 1, name: 'Auth', defaultSlaHours: 8 },
  { id: 2, name: 'Billing', defaultSlaHours: 24 },
];

export function authResponse(user: CurrentUserDto = agentUser, suffix = '1'): AuthResponse {
  return {
    accessToken: `access-${suffix}`,
    refreshToken: `refresh-${suffix}`,
    accessTokenExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    user,
  };
}

export const ticketItems: TicketListItemDto[] = [
  {
    id: 1024,
    title: 'Không đăng nhập được',
    status: 'Open',
    priority: 'High',
    categoryId: 1,
    categoryName: 'Auth',
    assigneeId: agentUser.id,
    assigneeName: 'An Agent',
    createdById: customerUser.id,
    createdByName: 'Khách Hàng',
    createdAt: '2026-09-20T09:50:00Z',
    resolveDueAt: '2026-09-21T09:50:00Z',
    slaState: 'AtRisk',
    commentCount: 2,
  },
  {
    id: 1023,
    title: 'Lỗi xuất hóa đơn',
    status: 'InProgress',
    priority: 'Medium',
    categoryId: 2,
    categoryName: 'Billing',
    assigneeId: assignees[1].id,
    assigneeName: 'Bình Agent',
    createdById: customerUser.id,
    createdByName: 'Khách Hàng',
    createdAt: '2026-09-19T08:00:00Z',
    resolveDueAt: '2026-09-25T08:00:00Z',
    slaState: 'OnTrack',
    commentCount: 0,
  },
];

export function ticketDetail(overrides: Partial<TicketDetailDto> = {}): TicketDetailDto {
  return {
    id: 1024,
    title: 'Không đăng nhập được',
    description: 'Tôi không đăng nhập được từ sáng nay',
    status: 'Open',
    priority: 'High',
    category: { id: 1, name: 'Auth' },
    createdBy: { id: customerUser.id, fullName: 'Khách Hàng' },
    assignee: { id: agentUser.id, fullName: 'An Agent' },
    createdAt: '2026-09-20T09:50:00Z',
    updatedAt: null,
    firstRespondedAt: null,
    resolvedAt: null,
    closedAt: null,
    responseDueAt: '2026-09-20T13:50:00Z',
    resolveDueAt: '2026-09-21T09:50:00Z',
    slaState: 'AtRisk',
    rowVersion: 'AAAAAAAAB9E=',
    allowedTransitions: ['InProgress', 'Pending', 'Resolved', 'Closed'],
    canChangePriority: true,
    canAssign: true,
    canComment: true,
    comments: [],
    attachments: [],
    ...overrides,
  };
}

export const apiLogItems: ApiLogListItemDto[] = [
  {
    id: 88,
    module: 'Helpdesk',
    traceId: '00-8e50f81fa0e437c95984f29d2ce65ecc-14eb4b45a65c7a78-00',
    ip: '127.0.0.1',
    userId: adminUser.id,
    userName: 'admin@helpdesk.local',
    method: 'GET',
    url: '/api/v1/tickets/999999',
    statusCode: 404,
    durationMs: 23,
    createdDate: '2026-09-23T08:34:03.733Z',
  },
  {
    id: 86,
    module: 'Helpdesk',
    traceId: '00-870670991e289457a8ba52f2c55e04c9-071c692fc15725e3-00',
    ip: '::1',
    userId: null,
    userName: null,
    method: 'POST',
    url: '/api/v1/auth/login',
    statusCode: 200,
    durationMs: 620,
    createdDate: '2026-09-23T08:30:06.746Z',
  },
];

export function apiLogDetail(id: number): ApiLogDetailDto {
  const item = apiLogItems.find((l) => l.id === id) ?? apiLogItems[0];
  return {
    ...item,
    request: item.method === 'POST' ? JSON.stringify({ email: 'admin@helpdesk.local', password: '***' }) : null,
    response: JSON.stringify({ title: 'Không tìm thấy', status: 404 }),
    userAgent: 'Mozilla/5.0 (test)',
  };
}
