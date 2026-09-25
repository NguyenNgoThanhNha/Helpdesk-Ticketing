// Types mirroring docs/API-CONTRACT.md (v1, permission-based authorization)

export const ACTIVITY_ACTIONS = ['C', 'R', 'U', 'D'] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

/** Activity codes shared by FE/BE (see API contract "Phân quyền"). */
export const ACTIVITY = {
  TICKET: 'TICKET',
  TICKET_ASSIGN: 'TICKET_ASSIGN',
  COMMENT: 'COMMENT',
  REPORT: 'REPORT',
  CATEGORY: 'CATEGORY',
  SLA_POLICY: 'SLA_POLICY',
  USER: 'USER',
  ROLE: 'ROLE',
  API_LOG: 'API_LOG',
} as const;
export type ActivityCode = (typeof ACTIVITY)[keyof typeof ACTIVITY];

export const TICKET_STATUSES = ['New', 'Open', 'InProgress', 'Pending', 'Resolved', 'Closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const SLA_STATES = ['OnTrack', 'AtRisk', 'Breached', 'Met'] as const;
export type SlaState = (typeof SLA_STATES)[number];

export const TICKET_SORTS = [
  'createdAt_desc',
  'createdAt_asc',
  'priority_desc',
  'priority_asc',
  'status_asc',
  'status_desc',
  'resolveDueAt_asc',
  'resolveDueAt_desc',
  'title_asc',
  'title_desc',
] as const;
export type TicketSort = (typeof TICKET_SORTS)[number];

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  errors?: Record<string, string[]>;
  traceId?: string;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

// ---- Auth / permissions ----
export interface CrudFlags {
  c: boolean;
  r: boolean;
  u: boolean;
  d: boolean;
}

export interface PermissionDto extends CrudFlags {
  code: string;
}

export interface CurrentUserDto {
  id: string;
  email: string;
  fullName: string;
  isAdmin: boolean;
  /** role names */
  roles: string[];
  /** effective permissions (only activities with at least one flag set) */
  permissions: PermissionDto[];
}

export interface UserSummaryDto {
  id: string;
  fullName: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  user: CurrentUserDto;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
}

export interface ResetPasswordRequest {
  email: string;
  token: string;
  newPassword: string;
}

// ---- Users / roles / activities ----
export interface RoleRefDto {
  id: string;
  name: string;
}

export interface UserListItemDto {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  roles: RoleRefDto[];
  createdDate: string;
}

export interface UsersQuery {
  search?: string;
  roleId?: string;
  page?: number;
  pageSize?: number;
}

export interface UpdateUserRequest {
  isActive: boolean;
}

export interface ActivityPermissionInput extends CrudFlags {
  activityId: string;
}

export interface ActivityPermissionDto extends CrudFlags {
  activityId: string;
  code: string;
  name: string;
}

export interface UserPermissionDetailDto {
  userId: string;
  isAdmin: boolean;
  roles: RoleRefDto[];
  /** permissions granted directly to the account (UserActivity) */
  userActivities: ActivityPermissionDto[];
  /** effective permissions = roles OR user-specific */
  effective: ActivityPermissionDto[];
}

export interface ActivityDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

export interface RoleDto {
  id: string;
  name: string;
  description: string | null;
  isAdmin: boolean;
  userCount: number;
}

export interface RoleDetailDto extends RoleDto {
  activities: ActivityPermissionDto[];
}

export interface RoleRequest {
  name: string;
  description?: string | null;
  activities: ActivityPermissionInput[];
}

// ---- Tickets ----
export interface TicketListItemDto {
  id: number;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  categoryId: number;
  categoryName: string;
  assigneeId: string | null;
  assigneeName: string | null;
  createdById: string;
  createdByName: string;
  createdAt: string;
  resolveDueAt: string | null;
  slaState: SlaState;
  commentCount: number;
}

export interface TicketsQuery {
  status?: TicketStatus;
  priority?: TicketPriority;
  categoryId?: number;
  /** user id, or the special values `me` / `unassigned` */
  assigneeId?: string;
  search?: string;
  slaState?: SlaState;
  page?: number;
  pageSize?: number;
  sort?: TicketSort;
}

export interface AttachmentDto {
  id: number;
  fileName: string;
  contentType: string;
  size: number;
  commentId: number | null;
  uploadedAt: string;
}

export interface CommentDto {
  id: number;
  author: UserSummaryDto;
  /** true = written by the ticket's requester */
  isFromRequester: boolean;
  body: string;
  createdAt: string;
  attachments: AttachmentDto[];
}

export interface TicketDetailDto {
  id: number;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: { id: number; name: string };
  createdBy: UserSummaryDto;
  assignee: UserSummaryDto | null;
  createdAt: string;
  updatedAt: string | null;
  firstRespondedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  responseDueAt: string | null;
  resolveDueAt: string | null;
  slaState: SlaState;
  rowVersion: string;
  /** statuses the current user may move to (permissions already applied) */
  allowedTransitions: TicketStatus[];
  /** TICKET:U */
  canChangePriority: boolean;
  /** TICKET_ASSIGN:U */
  canAssign: boolean;
  /** COMMENT:C and ticket not Closed */
  canComment: boolean;
  comments: CommentDto[];
  attachments: AttachmentDto[];
}

export interface CreateTicketRequest {
  title: string;
  description: string;
  categoryId: number;
  priority: TicketPriority;
}

export interface UpdateTicketRequest {
  rowVersion: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  assigneeId?: string | null;
  unassign?: boolean;
}

export type TicketHistoryField = 'Created' | 'Status' | 'Priority' | 'Assignee' | 'Sla';

export interface TicketHistoryDto {
  id: number;
  field: TicketHistoryField | string;
  oldValue: string | null;
  newValue: string | null;
  /** null = system (SLA job) */
  changedBy: UserSummaryDto | null;
  changedAt: string;
}

// ---- Categories / SLA ----
export interface CategoryDto {
  id: number;
  name: string;
  defaultSlaHours: number;
}

export interface CategoryRequest {
  name: string;
  defaultSlaHours: number;
}

export interface SlaPolicyDto {
  id: number;
  priority: TicketPriority;
  responseHours: number;
  resolveHours: number;
}

export interface SlaPolicyRequest {
  responseHours: number;
  resolveHours: number;
}

// ---- Notifications ----
export interface NotificationDto {
  id: number;
  message: string;
  ticketId: number | null;
  isRead: boolean;
  createdAt: string;
}

// ---- Realtime (SignalR hub /hubs/notifications) ----
export type TicketChange = 'updated' | 'commented' | 'attachment' | 'sla';

/** `ticketChanged` event, sent to clients that called `JoinTicket(ticketId)`. */
export interface TicketChangedEvent {
  ticketId: number;
  change: TicketChange;
  /** user who made the change; null = system (SLA job) */
  actorId: string | null;
}

// ---- Reports ----
export interface KeyCount {
  key: string;
  count: number;
}

export interface AgentPerformanceDto {
  agentId: string;
  agentName: string;
  assigned: number;
  resolved: number;
  avgResolutionHours: number | null;
  slaComplianceRate: number | null;
}

export interface ReportSummaryDto {
  totalTickets: number;
  openTickets: number;
  breachedTickets: number;
  avgResolutionHours: number | null;
  slaComplianceRate: number | null;
  byStatus: KeyCount[];
  byCategory: KeyCount[];
  byDay: { date: string; count: number }[];
  agentPerformance: AgentPerformanceDto[];
}

// ---- API logs (API_LOG:R) ----
export interface ApiLogListItemDto {
  id: number;
  module: string;
  traceId: string;
  ip: string | null;
  userId: string | null;
  userName: string | null;
  method: string;
  url: string;
  statusCode: number;
  durationMs: number;
  createdDate: string;
}

export interface ApiLogDetailDto extends ApiLogListItemDto {
  request: string | null;
  response: string | null;
  userAgent: string | null;
}

export interface ApiLogsQuery {
  traceId?: string;
  userId?: string;
  url?: string;
  method?: string;
  statusCode?: number;
  /** ISO date-time (the API compares against CreatedDate as DateTime) */
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}
